from fastapi import FastAPI

print("APP FILE LOADED")

app = FastAPI()

@app.get("/")
def root():
    print("ROOT HIT")
    return {"hello": "world"}