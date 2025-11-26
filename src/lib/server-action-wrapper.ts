"use server";

export async function serverActionWrapper<T>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("Server Action Error:", err);
    throw new Error("Something went wrong. Try again.");
  }
}





