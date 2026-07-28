"""OpenTelemetry tracing setup — every LLM call and tool execution gets a
span with model/token/latency/cost attributes (see traced_llm_call below),
closing the "every AI request should be traceable end-to-end" gap.
opentelemetry-api/sdk are already installed (a crewai dependency — see
requirements.txt — previously unused by this app's own code), so this adds
no new dependency.

Exports to console by default: there's no OTel collector/Jaeger available in
this dev environment (see python-agent/.env's note about Docker Desktop
being unavailable here). Set OTEL_EXPORTER_OTLP_ENDPOINT to route spans to a
real collector instead, with zero code changes anywhere that calls tracer.

Known limitation: tool execution (app.agent.graph's tools_node) and the
orchestrator's specialist fan-out (app.agent.orchestrator) both run inside a
ThreadPoolExecutor — OTel span context doesn't automatically propagate
across that thread boundary via .submit()/.map(), so those spans won't
always nest correctly under a request's root span in the exporter output.
Not fixed here (would need explicit context propagation into each worker
thread); flagged rather than silently accepted as "it just works."
"""

import os
import time
from contextlib import contextmanager

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor

from app.observability.cost import estimate_cost

_provider = TracerProvider(resource=Resource.create({"service.name": "python-agent"}))

_otlp_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
if _otlp_endpoint:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

    _provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=_otlp_endpoint)))
else:
    _provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))

trace.set_tracer_provider(_provider)
tracer = trace.get_tracer("python-agent")


@contextmanager
def traced_llm_call(name: str, **attributes):
    """Wraps one Anthropic API call. Usage: `with traced_llm_call("classify") as
    usage: ... usage["input_tokens"] = response.usage.input_tokens; usage["output_tokens"] = ...`
    — token/cost attributes are only recorded if the caller fills in `usage`;
    an empty dict (e.g. the call raised before getting a response) just
    records latency, never breaks the call itself.
    """
    start = time.monotonic()
    with tracer.start_as_current_span(f"llm.{name}") as span:
        for key, value in attributes.items():
            span.set_attribute(key, value)
        usage: dict = {}
        try:
            yield usage
        finally:
            span.set_attribute("latency_ms", (time.monotonic() - start) * 1000)
            if usage:
                input_tokens = usage.get("input_tokens", 0)
                output_tokens = usage.get("output_tokens", 0)
                span.set_attribute("tokens.input", input_tokens)
                span.set_attribute("tokens.output", output_tokens)
                span.set_attribute("cost.usd", estimate_cost(input_tokens, output_tokens))


@contextmanager
def traced_tool_call(name: str, user_id: str = ""):
    start = time.monotonic()
    with tracer.start_as_current_span(f"tool.{name}") as span:
        span.set_attribute("tool.name", name)
        span.set_attribute("user_id", user_id)
        outcome: dict = {}
        try:
            yield outcome
        finally:
            span.set_attribute("latency_ms", (time.monotonic() - start) * 1000)
            span.set_attribute("success", outcome.get("success", True))
