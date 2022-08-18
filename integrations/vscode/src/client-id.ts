import crypto from "crypto";

export const clientId = crypto.randomBytes(16).toString("hex");
