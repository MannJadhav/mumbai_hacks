import os
import json
from typing import List, Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from agno.agent import Agent
from agno.models.google import Gemini
from dotenv import load_dotenv
from agno.tools.duckduckgo import DuckDuckGoTools
from utils.FinancialNewsAgent import verify_financial_news
from utils.PolicitalNewsAgent import verify_political_news
from utils.SportNewsAgent import verify_sports_news

TOOLS = [verify_financial_news, verify_political_news, verify_sports_news]

load_dotenv()

if not os.getenv("GOOGLE_API_KEY"):
    print("WARNING: GOOGLE_API_KEY is missing from environment.")


class GeminiResponse(BaseModel):
    answer: str = Field(
        ...,
        description="A concise, clear answer to the user's query. Keep it under 50 words.",
    )
    follow_up_queries: List[str] = Field(
        ...,
        description="Exactly 3 short, relevant follow-up topics or questions (max 4-6 words each).",
        min_length=3,
        max_length=3,
    )


class QueryRequest(BaseModel):
    query: str
    context: str = ""


response_schema_str = json.dumps(GeminiResponse.model_json_schema(), indent=2)

agent = Agent(
    model=Gemini(id="gemini-2.5-flash"),
    description="You are a knowledge graph generator.",
    tools=TOOLS,
   
    instructions=[
        "You are the Chief Dispatcher of a Fact-Checking Bureau.",
        "### CORE OBJECTIVE:",
        "Route user queries to the correct specialized department tool and present the findings.",
        "### OPERATIONAL PROTOCOL:",
        "1. **Analyze the Query**: Classify into Finance, Politics, or Sports.",
        "2. **Strict Delegation**: Use the tools `verify_financial_news`, `verify_political_news`, or `verify_sports_news`.",
        "3. **Handling Ambiguity**: Prioritize the *primary subject*.",
        "4. **Out of Scope**: State 'I can only verify news regarding Finance, Politics, or Sports.'",
        "### OUTPUT FORMAT (STRICT):",
        "You must output a VALID JSON object (no markdown, no backticks) matching this schema:",
        f"{response_schema_str}",  # We inject the Pydantic schema here
        "Ensure 'answer' contains the tool's verdict and 'follow_up_queries' contains 3 distinct next steps.",
    ],
    markdown=False,
)


class Source(BaseModel):
    title: str
    url: str


class FactCheckReport(BaseModel):
    verdict: Literal["True", "False", "Misleading", "Unverified", "Satire"] = Field(
        ..., description="The definitive conclusion of the fact check."
    )
    confidence_score: int = Field(
        ..., description="Confidence score between 0 and 100.", ge=0, le=100
    )
    summary: str = Field(
        ..., description="A 2-sentence summary of why the claim is true or false."
    )
    detailed_analysis: str = Field(
        ..., description="A detailed explanation citing specific events or data."
    )
    sources: List[Source] = Field(
        ..., description="List of reliable sources used for verification."
    )
    follow_up_questions: List[str] = Field(
        ..., description="3 relevant questions to dive deeper into the topic."
    )


class CheckRequest(BaseModel):
    claim: str
    context: str = ""


report_schema_str = json.dumps(FactCheckReport.model_json_schema(), indent=2)

fact_check_agent = Agent(
    model=Gemini(id="gemini-2.5-flash"),
    tools=[DuckDuckGoTools()],
    description="You are an investigative journalist and strict fact-checker.",
    instructions=[
        "### ROLE",
        "You verify claims by searching the web for credible sources.",
        "### PROCESS",
        "1. Search for the user's claim using the DuckDuckGo tool.",
        "2. Cross-reference at least 2 distinct reputable sources (e.g., Reuters, AP, Official Gov Stats).",
        "3. Determine a verdict: True, False, Misleading, Unverified, or Satire.",
        "4. Assign a confidence score (0-100) based on source consensus.",
        "### OUTPUT FORMAT (STRICT)",
        "You must output ONLY valid JSON matching this schema:",
        f"{report_schema_str}",
        "Do not include markdown formatting (like ```json). Just the raw JSON string.",
    ],
    markdown=False,
)


app = FastAPI(title="Agno Gemini Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def clean_json_string(content: str) -> str:
    """Removes markdown code blocks if the LLM includes them."""
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()


@app.post("/generate", response_model=GeminiResponse)
async def fetch_gemini_response(request: QueryRequest):
    if not os.getenv("GOOGLE_API_KEY"):
        return GeminiResponse(
            answer="I need a valid API Key.",
            follow_up_queries=["Add Key", "Check Env", "Retry"],
        )

    try:
        formatted_prompt = f"Context: {request.context}\n\nUser Query: {request.query}"

        
        response = agent.run(formatted_prompt)

        cleaned_content = clean_json_string(response.content)

        try:
            data = json.loads(cleaned_content)
        except json.JSONDecodeError:
          
            print(f"JSON Parse Error. Raw content: {response.content}")
            return GeminiResponse(
                answer=str(response.content)[
                    :200
                ],
                follow_up_queries=["Retry Query", "System Error", "Check Logs"],
            )

     
        validated_response = GeminiResponse(**data)

        return validated_response

    except Exception as e:
        print(f"Gemini API Error: {e}")
       
        return GeminiResponse(
            answer=f"Error processing request: {str(e)}",
            follow_up_queries=["Try Again", "Refine Query", "Contact Support"],
        )


def clean_json_response(content: str) -> str:
    content = content.strip()
 
    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()


@app.post("/verify", response_model=FactCheckReport)
async def verify_claim(request: CheckRequest):
    """
    Endpoint to verify a specific claim using Web Search.
    """
    try:
       
        prompt = (
            f"Please verify this claim: '{request.claim}'\n"
            f"Additional Context: {request.context}\n\n"
            "Use your search tools to find recent evidence. Return the JSON report."
        )


        response = fact_check_agent.run(prompt)

    
        cleaned_json = clean_json_response(response.content)

        try:
            data = json.loads(cleaned_json)
          
            report = FactCheckReport(**data)
            return report
        except json.JSONDecodeError:
          
            print(f"JSON Parse Failed. Raw: {response.content}")
            raise HTTPException(
                status_code=500, detail="Agent failed to produce valid JSON."
            )

    except Exception as e:
        print(f"Internal Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
