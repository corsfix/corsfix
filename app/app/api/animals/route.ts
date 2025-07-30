import { ApiResponse } from "@/types/api";
import { NextResponse } from "next/server";

const animals = [
  "lion",
  "elephant",
  "giraffe",
  "penguin",
  "dolphin",
  "koala",
  "tiger",
  "panda",
  "kangaroo",
  "zebra",
];

export async function GET() {
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];

  return NextResponse.json<ApiResponse<string>>({
    data: randomAnimal,
    message: "You successfully fetched an animal",
    success: true,
  });
}
