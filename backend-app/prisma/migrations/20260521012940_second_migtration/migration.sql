/*
  Warnings:

  - You are about to drop the column `fatStatus` on the `NutritionScan` table. All the data in the column will be lost.
  - You are about to drop the column `saturatedFat` on the `NutritionScan` table. All the data in the column will be lost.
  - You are about to drop the column `sodium` on the `NutritionScan` table. All the data in the column will be lost.
  - You are about to drop the column `sodiumStatus` on the `NutritionScan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "NutritionScan" DROP COLUMN "fatStatus",
DROP COLUMN "saturatedFat",
DROP COLUMN "sodium",
DROP COLUMN "sodiumStatus";
