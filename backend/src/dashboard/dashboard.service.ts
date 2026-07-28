import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { ChatService } from '../chat/chat.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { resolveAllowedAgentIds } from './agent-scope.util';
import { DailyReport, DailyReportDocument, DailyReportTask } from './schemas/daily-report.schema';

interface GenerateReportResult {
  reply: string;
  tasks: DailyReportTask[];
  summary: string;
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  private readonly agentUrl: string;

  constructor(
    @InjectModel(DailyReport.name) private reportModel: Model<DailyReportDocument>,
    private http: HttpService,
    private config: ConfigService,
    private jwt: JwtService,
    private chatService: ChatService,
  ) {
    this.agentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  /** Generates one representative report via python-agent's CrewAI-backed
   * research -> prioritize -> write crew (app/agent/crew_reports.py) and
   * upserts it as a DailyReport against the (agentId, reportType, date)
   * unique index — called once per scheduled run by
   * StoreSettingsService.runForAllUsers, not once per user. A single round
   * trip to /reports/generate replaces what used to be two calls (a plain
   * chat turn via generateSystemConversation, then a separate
   * /reports/structure call on its reply) — the crew produces its own reply
   * and structures it server-side in one request. */
  async recordDailyReport(input: {
    agentId: string;
    reportType: 'morning' | 'eod';
    date: string;
    conversationId: string;
    userId: string;
  }) {
    const userJwt = this.jwt.sign({ sub: input.userId }, { expiresIn: '5m' });
    const { data } = await firstValueFrom(
      this.http.post<GenerateReportResult>(
        `${this.agentUrl}/reports/generate`,
        { report_type: input.reportType },
        { headers: { Authorization: `Bearer ${userJwt}` } },
      ),
    );

    return this.reportModel
      .findOneAndUpdate(
        { agentId: input.agentId, reportType: input.reportType, date: input.date },
        {
          tasks: data.tasks,
          summary: data.summary,
          sourceConversationId: input.conversationId,
          sourceUserId: input.userId,
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  /** agentId, when provided, restricts the response to just that one agent —
   * ON TOP OF the existing RBAC scoping below, never instead of it, so an
   * admin can only drill into an agent they're already allowed to see (a
   * no-op filter for agent_user, whose `agents` array only ever has one
   * entry anyway). Fails closed (404, matching TasksService.updateStatus's
   * convention) rather than silently falling back to the unfiltered view or
   * an ambiguous empty response. */
  async getOverview(caller?: JwtPayload, agentId?: string) {
    const date = todayStamp();
    const [allReports, agents] = await Promise.all([
      // .lean() — plain JS objects, not Mongoose Documents/subdocuments.
      // Spreading a Mongoose subdocument (r.tasks[i]) with {...t} silently
      // drops its schema-defined fields (they live behind getters, not as
      // own enumerable properties), which broke urgentCount/overdueCount
      // below until this was added.
      this.reportModel.find({ date }).sort({ updatedAt: -1 }).lean().exec(),
      this.chatService.listAgents(caller),
    ]);

    // listAgents(caller) already scopes `agents` down to one entry for an
    // agent_user — but without ALSO filtering the reports themselves,
    // stats/criticalAlerts/recentReports below would still leak every other
    // agent's data even though the agent card list looks correctly scoped.
    let scopedAgentIds = new Set(agents.map((a) => a.id));
    if (agentId) {
      if (!scopedAgentIds.has(agentId)) {
        throw new NotFoundException('Agent not found');
      }
      scopedAgentIds = new Set([agentId]);
    }
    const reports = allReports.filter((r) => scopedAgentIds.has(r.agentId));
    const scopedAgents = agents.filter((a) => scopedAgentIds.has(a.id));

    const byAgent = new Map<string, (typeof reports)[number][]>();
    for (const r of reports) {
      byAgent.set(r.agentId, [...(byAgent.get(r.agentId) ?? []), r]);
    }

    const agentsOut = scopedAgents.map((a) => {
      const own = byAgent.get(a.id) ?? [];
      const latest = own.find((r) => r.reportType === 'eod') ?? own.find((r) => r.reportType === 'morning');
      return {
        id: a.id,
        name: a.name,
        avatarColor: a.avatarColor,
        status: latest ? ('reported' as const) : ('pending' as const),
        todaysTaskCount: own.reduce((n, r) => n + r.tasks.length, 0),
        lastReportType: latest?.reportType,
        lastReportAt: latest?.updatedAt,
      };
    });

    const allTasks = reports.flatMap((r) =>
      r.tasks.map((t) => ({ ...t, agentId: r.agentId, reportId: r._id.toString() })),
    );
    const urgentCount = allTasks.filter((t) => t.priority === 'urgent').length;
    const overdueCount = allTasks.filter((t) => t.isOverdue).length;
    const totalTasks = allTasks.length;

    return {
      date,
      agents: agentsOut,
      stats: {
        totalTasks,
        urgentCount,
        overdueCount,
        reportsGenerated: reports.length,
        followUpHealthPct: totalTasks === 0 ? null : Math.round((1 - overdueCount / totalTasks) * 100),
      },
      criticalAlerts: allTasks.filter((t) => t.priority === 'urgent' || t.isOverdue).slice(0, 20),
      recentReports: reports.map((r) => ({
        id: r._id.toString(),
        agentId: r.agentId,
        reportType: r.reportType,
        summary: r.summary,
        taskCount: r.tasks.length,
        sourceConversationId: r.sourceConversationId,
        createdAt: r.createdAt,
      })),
    };
  }

  /** Historical per-day breakdown for one agent — always single-agent, used
   * only by the focused drill-down view's trend chart. Every day in the
   * range gets a point (zero-filled), even with no report — a day the agent
   * didn't submit is a meaningful zero, not a gap to skip, matching
   * getOverview's existing "pending" vs "reported" status framing. */
  async getTrend(agentId: string, days: 7 | 30, caller?: JwtPayload) {
    const allowedAgentIds = await resolveAllowedAgentIds(this.chatService, caller);
    if (!allowedAgentIds.includes(agentId)) {
      throw new NotFoundException('Agent not found');
    }

    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const reports = await this.reportModel
      .find({ agentId, date: { $gte: dates[0], $lte: dates[dates.length - 1] } })
      .lean()
      .exec();

    const byDate = new Map<string, { totalTasks: number; urgentCount: number; overdueCount: number }>();
    for (const r of reports) {
      const cur = byDate.get(r.date) ?? { totalTasks: 0, urgentCount: 0, overdueCount: 0 };
      cur.totalTasks += r.tasks.length;
      cur.urgentCount += r.tasks.filter((t) => t.priority === 'urgent').length;
      cur.overdueCount += r.tasks.filter((t) => t.isOverdue).length;
      byDate.set(r.date, cur);
    }

    const points = dates.map((date) => {
      const v = byDate.get(date) ?? { totalTasks: 0, urgentCount: 0, overdueCount: 0 };
      return {
        date,
        ...v,
        followUpHealthPct: v.totalTasks === 0 ? null : Math.round((1 - v.overdueCount / v.totalTasks) * 100),
      };
    });
    return { agentId, days, points };
  }
}
