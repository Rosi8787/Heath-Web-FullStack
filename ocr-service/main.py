from fastapi import FastAPI

print("APP FILE LOADED")

app = FastAPI()

@app.get("/")
def root():
    print("ROOT HIT")
    return {"hello": "world"}

if __name__ == "__main__":
    import os
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8080))
    )