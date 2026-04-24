"use client";

import React from "react";

interface SubmitRowProps {
  isSubmitting?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  formError?: string | null;
}

export function SubmitRow({
  isSubmitting,
  onCancel,
  cancelLabel = "Cancel",
  submitLabel = "Save",
  formError,
}: SubmitRowProps) {
  return (
    <div className="submit-row">
      {formError && (
        <span className="field-error submit-row-error" role="alert">
          {formError}
        </span>
      )}
      <div className="submit-row-actions">
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel}
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
