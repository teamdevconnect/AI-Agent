def choose_provider(state: dict) -> str:
    """This app is Anthropic-only; every turn goes to Claude."""
    return "anthropic"
