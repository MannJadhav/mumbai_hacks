from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools import tool
from agno.tools.duckduckgo import DuckDuckGoTools


@tool
def verify_sports_news(news_query: str) -> str:
    """
    Use this function to verify sports results, transfer rumors, player statistics,
    or upcoming match schedules.

    Args:
        news_query (str): The sports news statement to verify.

    Returns:
        str: A detailed fact-check report from the Sports Department.
    """
    sport_specialist = Agent(
        model=Gemini(id="gemini-flash-latest"),
        tools=[DuckDuckGoTools()],  
        instructions=[
            "You are a Senior Sports Statistician and News Analyst.",
            "Your job is to verify transfer rumors, match results, and player statistics.",
            "1. Differentiate between 'Official Club Statements' and 'Tabloid Rumors'.",
            "2. If a transfer is not confirmed by the club or a Tier 1 source (like Fabrizio Romano), label it as a Rumor.",
            "3. Verify exact scores and player records using search tools.",
            "Respond with the ultimate truth based on available data.",
        ],
        markdown=True,
    )

    response = sport_specialist.run(news_query)
    return response.content
