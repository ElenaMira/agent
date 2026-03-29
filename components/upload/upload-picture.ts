// src/components/upload/upload-picture.ts
import { toast } from "sonner";

export async function uploadPictureFile(file: File) {
  if (!file.type.startsWith("image/")) {
    toast.error("只能上传图片");
    return null;
  }

  const formData = new FormData();
  formData.append("file", file);

  toast.loading("正在上传图片...", { id: "upload-picture" });

  try {
    const res = await fetch("/api/retrieval", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "上传失败");
    }

    toast.success("图片上传成功！", { id: "upload-picture" });

    // 关键：后端返回的图片 URL（你原来的 /api/retrieval/picture 必须返回这个）
    return {
      success: true,
      url: json.url || json.imageUrl || json.fileUrl, // 根据你实际返回字段调整
      filename: file.name,
    };
  } catch (err: any) {
    toast.error("图片上传失败：" + err.message, { id: "upload-picture" });
    return null;
  }
}