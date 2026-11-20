import mongoose from "mongoose";

export default async function connectDatabase(uri: string) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const topology = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid")
    throw new Error("A MongoDB replica set or sharded cluster is required.");
  await Promise.all(
    mongoose.modelNames().map((name) => mongoose.model(name).init()),
  );
}
