# The Wattson API. Only the ask layer, the search layer and the narrate endpoint need
# this to exist -- every screen renders from the committed static export with no server.
# So this is an enhancement host, not the demo's critical path.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The data the API serves. All committed, all read-only at runtime.
COPY server/ ./server/
COPY claims/ ./claims/
COPY dashboard/public/data/ ./dashboard/public/data/
COPY contracts/ ./contracts/

EXPOSE 8080
CMD ["python", "-m", "uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8080"]
