from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools import tool
from utils.FinancialNewsAgent import verify_financial_news
from utils.PolicitalNewsAgent import verify_political_news
from utils.SportNewsAgent import verify_sports_news

TOOLS = [verify_financial_news, verify_political_news, verify_sports_news]


main_agent = Agent(
    model=Gemini(id="gemini-flash-latest"),
    tools=TOOLS,
    instructions=[
        "You are the Chief Dispatcher of a Fact-Checking Bureau.",
        "Your primary goal is to route user queries to the correct specialized department.",
        "### YOUR PROTOCOL:",
        "1. **Analyze the Query**: Determine if the text is related to Finance, Politics, or Sports.",
        "2. **Strict Delegation**: DO NOT answer the question yourself. You must use one of the available tools.",
        "3. **Tool Selection Logic**:",
        "   - Use `verify_financial_news` for: Stock markets, crypto, economy, inflation, company earnings, or scams.",
        "   - Use `verify_political_news` for: Elections, government policies, geopolitical conflicts, or statements by politicians.",
        "   - Use `verify_sports_news` for: Match results, player transfers, team stats, or athlete rumors.",
        "4. **Handling Ambiguity**: If a query fits two categories (e.g., a politician commenting on the economy), prioritize the *primary subject* of the claim.",
        "5. **Out of Scope**: If the user asks about a topic outside these three domains (e.g., entertainment, weather, cooking), politely state: 'I can only verify news regarding Finance, Politics, or Sports.'",
        "### OUTPUT FORMAT:",
        "Return the raw report provided by the department tool without altering the facts.",
    ],
   
    markdown=True,
)


if __name__ == "__main__":
    main_agent.print_response("Is Maithali thakur from BPJ party ?", stream=True)
