from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools import tool
from agno.tools.duckduckgo import DuckDuckGoTools
from dotenv import load_dotenv

load_dotenv()


@tool
def verify_financial_news(news_query: str) -> str:
    finance_specialist = Agent(
        model=Gemini(id="gemini-flash-latest"),
        tools=[DuckDuckGoTools()],
        instructions=[
            "You are a Senior Financial Analyst and Fraud Detector.",
            "Your goal is to check the facts and respond with the ultimate truth regarding the user's query.",
            "1. Search for the latest credible sources (Bloomberg, Reuters, SEC filings).",
            "2. If the claim is a 'get rich quick' scheme, label it as High Risk.",
            "3. Provide a clear Verdict (TRUE/FALSE/UNVERIFIED).",
        ],
        markdown=True,
    )

    response = finance_specialist.run(news_query)
    return response.content
