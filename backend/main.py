import asyncio
import json
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from analytics import (
    apply_filter,
    calculate_analytics,
    get_aspect_benchmark,
    get_filter_options,
    load_sentiment_data,
)
from config import create_openai_client, get_openai_config
from pipeline_sentiment import run_sentiment_pipeline
from runtime_store import get_latest_sentiment_bytes, get_latest_sentiment_df, get_latest_sentiment_filename, get_latest_sentiment_path
from product_summaries import SUMMARY_DIMENSION_LABELS, generate_group_summary, get_cached_summary
from data_agent import get_agent_schema, run_data_qa


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "input"
DEFAULT_SENTIMENT_INPUT_FILE = DEFAULT_OUTPUT_DIR / "unified_reviews_input.xlsx"
SETTINGS_FILE = ROOT / "settings.json"

app = FastAPI(title="Fiskars Sentiment Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SentimentRequest(BaseModel):
    unified_reviews_path: str | None = Field(default=None, description="Path to unified_reviews.xlsx")
    batch_size: int | None = Field(default=None, ge=1, description="Batch size for sentiment requests")
    max_reviews: int | None = Field(default=None, ge=1, description="Optional cap for number of reviews to analyze")


class SettingsModel(BaseModel):
    api_provider: str | None = Field(default=None, description="API provider: 'azure' or 'openai'")

class AgentMessage(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    question: str = Field(description="Natural language question for dataset QA")
    history: list[AgentMessage] = Field(default_factory=list)


class ChartInterpretRequest(BaseModel):
    prompt: str = Field(description="Chart data and interpretation request")


@app.get("/")
async def root():
    return {"message": "Fiskars sentiment backend is running", "status": "healthy"}


@app.get("/test")
async def test():
    return {"status": "success", "message": "Test endpoint is working!"}


@app.post("/pipeline/sentiment")
async def run_sentiment(request: SentimentRequest):
    unified_path = (
        Path(request.unified_reviews_path)
        if request.unified_reviews_path
        else DEFAULT_SENTIMENT_INPUT_FILE
    )
    try:
        stats = run_sentiment_pipeline(
            unified_reviews_path=unified_path,
            batch_size=request.batch_size,
            max_reviews=request.max_reviews,
        )
        return {"status": "success", "step": "sentiment", "stats": stats}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sentiment failed: {exc}") from exc
@app.post("/pipeline/sentiment/upload")
async def run_sentiment_with_upload(
    unified_reviews: UploadFile = File(...),
    batch_size: int | None = Form(default=None),
    max_reviews: int | None = Form(default=None),
):
    try:
        DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        unified_path = DEFAULT_SENTIMENT_INPUT_FILE
        unified_path.write_bytes(await unified_reviews.read())

        stats = run_sentiment_pipeline(
            unified_reviews_path=unified_path,
            batch_size=batch_size,
            max_reviews=max_reviews,
        )
        return {"status": "success", "step": "sentiment", "stats": stats}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sentiment upload failed: {exc}") from exc


@app.get("/pipeline/sentiment/download")
async def download_sentiment_enriched():
    try:
        content = get_latest_sentiment_bytes()
        filename = get_latest_sentiment_filename()
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
@app.get("/outputs/table")
async def get_output_table(name: str, limit: int = 200):
    if name != "sentiment_enriched":
        raise HTTPException(status_code=400, detail=f"Unsupported table name: {name}")

    try:
        df = get_latest_sentiment_df()
        sample = df.head(max(limit, 1))
        return {
            "status": "success",
            "name": name,
            "path": get_latest_sentiment_path(),
            "total_rows": int(len(df)),
            "columns": list(sample.columns),
            "rows": sample.fillna("").to_dict(orient="records"),
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read table: {exc}") from exc
@app.get("/settings")
async def get_settings():
    """Get current API provider setting from settings.json"""
    try:
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                settings = json.load(f)
                return {"status": "success", "settings": {"api_provider": settings.get("api_provider", "azure")}}
        else:
            return {"status": "success", "settings": {"api_provider": "azure"}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load settings: {exc}") from exc


@app.post("/settings")
async def save_settings(settings: SettingsModel):
    """Save API provider and agent mode to settings.json"""
    try:
        current_settings = {}
        if SETTINGS_FILE.exists():
            try:
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    if isinstance(loaded, dict):
                        current_settings = loaded
            except Exception:
                current_settings = {}

        merged = {
            "api_provider": current_settings.get("api_provider", "azure"),
        }
        updates = settings.model_dump(exclude_none=True)
        if updates.get("api_provider") in {"azure", "openai"}:
            merged["api_provider"] = updates["api_provider"]

        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2)
        return {"status": "success", "message": "Settings saved successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {exc}") from exc


@app.get("/analytics/filter-options")
async def get_filter_options_api():
    """Get available values for each filter dimension"""
    try:
        df = load_sentiment_data()
        options = get_filter_options(df)
        return {"status": "success", "data": options}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load filter options: {exc}") from exc


@app.get("/analytics/data")
async def get_analytics_data(dimension: str = "overall", value: str | None = None):
    """
    Get analytics for selected filter.

    Query params:
    - dimension: 'overall', 'country', 'source', 'reference_model', 'product_name', 'generation_family', 'region'
    - value: specific value for the dimension (not needed for 'overall')

    Returns:
    - 6 analytics: total_reviews, avg_rating, sentiment %, trends, aspect frequency
    """
    try:
        df = load_sentiment_data()

        # Apply filter
        if dimension != "overall" and value:
            filtered_df = df if dimension == "overall" else apply_filter(df, dimension, value)
        else:
            filtered_df = df

        # Calculate 6 analytics
        analytics = calculate_analytics(filtered_df)

        return {"status": "success", "filter": {"dimension": dimension, "value": value}, "data": analytics}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {exc}") from exc


@app.get("/analytics/aspect-benchmark")
async def get_aspect_benchmark_api(
    scope: str = "overall",
    source: str = "all",
    products: str | None = None,
    products_json: str | None = None,
    countries: str | None = None,
    countries_json: str | None = None,
):
    """
    Get aspect benchmark data for radar chart.

    Query params:
    - scope: 'overall', 'product', or 'country'
    - source: source filter value or 'all'
    - products: comma-separated product names (used when scope='product')
    - countries: comma-separated country names (used when scope='country')
    """
    try:
        if scope not in {"overall", "product", "country"}:
            raise HTTPException(status_code=400, detail="scope must be 'overall', 'product', or 'country'")

        selected_products: list[str] = []
        selected_countries: list[str] = []
        if products_json:
            try:
                parsed_products = json.loads(products_json)
                if isinstance(parsed_products, list):
                    selected_products = [str(p).strip() for p in parsed_products if str(p).strip()]
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid products_json: {exc}") from exc
        elif products:
            selected_products = [p.strip() for p in products.split(",") if p.strip()]

        if countries_json:
            try:
                parsed_countries = json.loads(countries_json)
                if isinstance(parsed_countries, list):
                    selected_countries = [str(c).strip() for c in parsed_countries if str(c).strip()]
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid countries_json: {exc}") from exc
        elif countries:
            selected_countries = [c.strip() for c in countries.split(",") if c.strip()]

        df = load_sentiment_data()
        payload = get_aspect_benchmark(
            df=df,
            scope=scope,
            source=source,
            products=selected_products,
            countries=selected_countries,
        )
        return {"status": "success", "data": payload}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Aspect benchmark failed: {exc}") from exc


@app.get("/summaries/filter")
async def get_filter_summary(dimension: str, value: str):
    """Get cached summary for a supported analytics filter value."""
    try:
        if dimension not in SUMMARY_DIMENSION_LABELS:
            raise HTTPException(status_code=400, detail=f"Unsupported summary dimension: {dimension}")

        cached = get_cached_summary(dimension, value)
        if cached:
            return {"status": "success", "exists": True, "data": cached}
        return {"status": "success", "exists": False}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load summary: {exc}") from exc


@app.post("/summaries/filter/generate")
async def generate_filter_summary(dimension: str, value: str):
    """Generate a fresh summary for a supported analytics filter value using the LLM."""
    try:
        if dimension not in SUMMARY_DIMENSION_LABELS:
            raise HTTPException(status_code=400, detail=f"Unsupported summary dimension: {dimension}")

        df = load_sentiment_data()
        filtered_df = df if dimension == "overall" else apply_filter(df, dimension, value)

        if len(filtered_df) == 0:
            label = SUMMARY_DIMENSION_LABELS[dimension]
            raise HTTPException(status_code=404, detail=f"No reviews found for {label}: {value}")

        summary = generate_group_summary(dimension, value, filtered_df)
        return {"status": "success", "data": summary}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {exc}") from exc

@app.get("/agent/health")
async def agent_health():
    try:
        schema = get_agent_schema()
        return {
            "status": "success",
            "table": schema["table"],
            "path": schema["path"],
            "row_count": schema["row_count"],
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent health check failed: {exc}") from exc


@app.get("/agent/schema")
async def agent_schema():
    try:
        return {"status": "success", "data": get_agent_schema()}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent schema failed: {exc}") from exc


@app.post("/agent/chat")
async def agent_chat(request: AgentChatRequest):
    try:
        history = [item.model_dump() for item in request.history]
        result = await run_data_qa(question=request.question, history=history)
        return {
            "status": "success",
            "answer": result.answer,
            "plan": result.plan,
            "evidence": result.evidence,
            "columns": result.columns,
            "rows": result.rows,
        }
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="No input data is found."
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Agent chat failed: {exc}"
        )


@app.post("/agent/chat/stream")
async def agent_chat_stream(request: AgentChatRequest):
    queue: asyncio.Queue = asyncio.Queue()
    history = [item.model_dump() for item in request.history]

    async def run_agent():
        try:
            result = await run_data_qa(question=request.question, history=history, event_queue=queue)
            await queue.put({
                "type": "done",
                "answer": result.answer,
                "plan": result.plan,
                "evidence": result.evidence,
                "columns": result.columns,
                "rows": result.rows,
            })
        except Exception as exc:
            await queue.put({"type": "error", "message": str(exc)})

    async def event_generator():
        task = asyncio.create_task(run_agent())
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event["type"] in ("done", "error"):
                break
        await task

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/interpret/chart")
async def interpret_chart(request: ChartInterpretRequest):
    """
    Interpret chart data using direct LLM call (bypasses data QA agent restrictions).
    Used for interpreting pre-calculated analytics like benchmarks, trends, etc.
    """
    try:
        config = get_openai_config(use_azure=True)
        client = create_openai_client(config)

        messages = [
            {
                "role": "system",
                "content": "You are a helpful business analyst assistant. You analyze chart data and provide clear, actionable insights in simple language that business users can understand. Focus on practical recommendations and key patterns."
            },
            {
                "role": "user",
                "content": request.prompt
            }
        ]

        response = client.chat.completions.create(
            model=config["model"],
            messages=messages
        )

        answer = response.choices[0].message.content

        return {
            "status": "success",
            "answer": answer
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate interpretation: {str(exc)}"
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)













