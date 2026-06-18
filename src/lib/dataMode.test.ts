import test from "node:test";
import assert from "node:assert/strict";
import { isDataModeSupabase } from "@/lib/dataMode";

const original = process.env.NEXT_PUBLIC_DATA_MODE;

test.after(() => {
  if (original === undefined) {
    delete process.env.NEXT_PUBLIC_DATA_MODE;
  } else {
    process.env.NEXT_PUBLIC_DATA_MODE = original;
  }
});

test("isDataModeSupabase: default sin env es mock", () => {
  delete process.env.NEXT_PUBLIC_DATA_MODE;
  assert.equal(isDataModeSupabase(), false);
});

test("isDataModeSupabase: true solo con valor exacto supabase", () => {
  process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
  assert.equal(isDataModeSupabase(), true);

  process.env.NEXT_PUBLIC_DATA_MODE = "mock";
  assert.equal(isDataModeSupabase(), false);

  process.env.NEXT_PUBLIC_DATA_MODE = "SUPABASE";
  assert.equal(isDataModeSupabase(), false);
});
