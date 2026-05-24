/*
  Warnings:

  - You are about to drop the column `rating` on the `contact` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "contact" DROP COLUMN "rating",
ADD COLUMN     "rating_beleza" DECIMAL(3,1),
ADD COLUMN     "rating_inteligencia" DECIMAL(3,1),
ADD COLUMN     "rating_lealdade" DECIMAL(3,1),
ADD COLUMN     "rating_respeito" DECIMAL(3,1),
ADD COLUMN     "rating_vestimenta" DECIMAL(3,1);
