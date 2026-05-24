"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(
  _prevState: { error: string },
  formData: FormData
): Promise<{ error: string }> {
  const username = (formData.get("username") as string ?? "").trim();
  const password = (formData.get("password") as string ?? "").trim();

  const validUser = process.env.ADMIN_USERNAME ?? "";
  const validPass = process.env.ADMIN_PASSWORD ?? "";

  if (username === validUser && password === validPass) {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", process.env.ADMIN_SESSION_SECRET!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    redirect("/admin");
  }

  return { error: "Usuario o contraseña incorrectos" };
}
