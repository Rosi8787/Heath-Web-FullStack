import { Injectable } from "@nestjs/common";
import axios from "axios";
import FormData from "form-data";

@Injectable()
export class AiService {

  async analyzeNutritionImage(
    file: Express.Multer.File,
  ) {

    // CREATE FORM DATA
    const formData = new FormData();

    formData.append(
      "file",
      file.buffer,
      file.originalname,
    );

    // SEND TO OCR SERVICE
    const response = await axios.post(
      "http://127.0.0.1:8000/ocr",
      formData,
      {
        headers: formData.getHeaders(),
      },
    );

    const text =
      response.data.text || "";

    console.log(text);

    // LOWERCASE
    const lowerText =
      text.toLowerCase();

    // SUGAR KEYWORDS
    const sugarKeywords = [
      "sugar",
      "sugars",
      "gula",
      "gula total",
      "glucose",
      "fructose",
      "sucrose",
    ];

    let sugar = 0;

    for (const keyword of sugarKeywords) {

      const regex =
        new RegExp(
          `${keyword}\\s*:?\\s*(\\d+(\\.\\d+)?)\\s*g`,
          "i",
        );

      const match =
        lowerText.match(regex);

      if (match) {

        sugar =
          Number(match[1]);

        break;
      }
    }

    // PRODUCT NAME
    const lines =
      text.split("\n");

    const productName =
      lines[0]?.trim()
      || "Unknown Product";

    // STATUS
    let sugarStatus = "";

    if (sugar <= 5) {
      sugarStatus = "Low Sugar";
    } else if (sugar <= 15) {
      sugarStatus = "Medium Sugar";
    } else {
      sugarStatus = "High Sugar";
    }

    return {

      extractedText: text,

      productName,

      sugar,

      sugarStatus,

      aiSummary:
        `This product contains ${sugar}g sugar and is classified as ${sugarStatus}.`,
    };
  }
}