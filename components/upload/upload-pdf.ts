// src/components/upload/upload-pdf.ts
import { toast } from "sonner";

export async function uploadPdfFile(file: File) {
  if (!file.type.includes("pdf")) {
    toast.error("只能上传 PDF 文件");
    return null;
  }

  const formData = new FormData();
  formData.append("file", file);

  toast.loading("正在上传 PDF...", { id: "upload-pdf" });

  try {
    const res = await fetch("/api/retrieval", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "上传失败");
    }

    toast.success("PDF 上传成功！已加入知识库", { id: "upload-pdf" });
    return { success: true };
  } catch (err: any) {
    toast.error("PDF 上传失败：" + err.message, { id: "upload-pdf" });
    return null;
  }
}