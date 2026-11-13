"use client";

import { useEffect } from "react";
import { INQUIRY_LIST_KEY } from "../inquiry-form";

// The inquiry was sent: the saved list in this browser starts empty again.
export function ClearInquiryList() {
  useEffect(() => {
    try {
      localStorage.removeItem(INQUIRY_LIST_KEY);
    } catch {
      // Storage blocked: nothing was saved.
    }
  }, []);
  return null;
}
