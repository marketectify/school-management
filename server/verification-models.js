import mongoose from "mongoose";
const { Schema } = mongoose;
export const VerificationChallenge = mongoose.model(
  "VerificationChallenge",
  new Schema(
    {
      email: { type: String, required: true },
      purpose: {
        type: String,
        enum: ["signup", "reset", "google-signup", "google-link"],
        required: true,
      },
      tokenDigest: { type: String, required: true, unique: true },
      codeDigest: { type: String, required: true },
      attempts: { type: Number, default: 0 },
      nextSendAt: { type: Date, required: true },
      expiresAt: { type: Date, required: true, expires: 0 },
      payload: {
        name: String,
        username: String,
        passwordHash: String,
        userId: Schema.Types.ObjectId,
        googleSub: String,
      },
    },
    { timestamps: true },
  ),
);
VerificationChallenge.schema.index({ email: 1, purpose: 1 }, { unique: true });
export const GoogleFlow = mongoose.model(
  "GoogleFlow",
  new Schema({
    digest: { type: String, required: true, unique: true },
    verifier: { type: String, required: true },
    nonce: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  }),
);
