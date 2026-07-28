"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAllowedAgentIds = resolveAllowedAgentIds;
async function resolveAllowedAgentIds(chatService, caller) {
    const agents = await chatService.listAgents(caller);
    return agents.map((a) => a.id);
}
//# sourceMappingURL=agent-scope.util.js.map