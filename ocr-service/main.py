from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    print("ROOT HIT")
    return {"hello": "world"}