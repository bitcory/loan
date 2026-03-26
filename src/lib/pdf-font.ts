import { Font } from "@react-pdf/renderer";
import path from "path";

let registered = false;

export function registerKoreanFont() {
  if (registered) return;
  Font.register({
    family: "NanumGothic",
    src: path.join(process.cwd(), "public/fonts/NanumGothic.ttf"),
  });
  registered = true;
}
