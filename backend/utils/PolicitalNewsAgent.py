from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools import tool
from agno.tools.duckduckgo import DuckDuckGoTools


@tool
def verify_political_news(news_query: str) -> str:
    """
    Use this function to verify political statements, election news,
    government policies, and geopolitical events.

    Args:
        news_query (str): The political news statement to verify.

    Returns:
        str: A detailed fact-check report from the Politics Department.
    """
    politics_specialist = Agent(
        model=Gemini(id="gemini-flash-latest"),
        tools=[DuckDuckGoTools()],
        instructions=[
            "You are a Non-Partisan Political Fact-Checker.",
            "Your job is to check the facts and respond with the ultimate truth.",
            "1. Verify statements made by politicians against official records and video transcripts.",
            "2. Watch out for 'Deepfakes', 'Out of Context' clips, and 'Misinformation'.",
            "3. Maintain absolute neutrality. Do not verify based on opinion, only on evidence.",
            "4. Cite your sources (e.g., 'According to the official parliament record...').",
        ],
        markdown=True,
    )

    response = politics_specialist.run(news_query)
    return response.content
