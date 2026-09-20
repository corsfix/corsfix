import mongoose, { Document, Model, Schema } from "mongoose";

// One document per origin domain per calendar month (UTC).
// _id is "{domain}:{YYYY-MM}" so the counter follows the domain, not the
// account or application that owns it.
export interface FreeTierMonthlyEntity extends Document {
  _id: string;
  domain: string;
  month: string;
  req_count: number;
  bytes: number;
}

const FreeTierMonthlySchema = new Schema<FreeTierMonthlyEntity>(
  {
    _id: String,
    domain: String,
    month: String,
    req_count: Number,
    bytes: Number,
  },
  { collection: "freetiermonthly" }
);

FreeTierMonthlySchema.index({ domain: 1, month: 1 });

export const FreeTierMonthlyEntity: Model<FreeTierMonthlyEntity> =
  mongoose.models.FreeTierMonthly ||
  mongoose.model("FreeTierMonthly", FreeTierMonthlySchema);
