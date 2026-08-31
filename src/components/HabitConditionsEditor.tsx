"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  HabitCondition,
  ConditionOperator,
  ConditionFrequency,
  ConditionOutcome,
  CONDITION_OPERATORS,
  CONDITION_FREQUENCIES,
  OPERATOR_LABELS,
  FREQUENCY_LABELS,
  EMAIL_TAGS,
  DEFAULT_ALERT_SUBJECT,
  DEFAULT_ALERT_BODY,
} from "@/utils/habitConditions";

// Count is kept as a string-ish value while editing so the field can be empty.
export interface ConditionInput extends Omit<HabitCondition, 'count'> {
  count: number | "";
}

export const emptyCondition = (): ConditionInput => ({
  trackingValue: "",
  operator: ">",
  count: "",
  frequency: "weekly",
  outcome: "fine",
});

export const MAX_CONDITIONS = 5;

interface HabitConditionsEditorProps {
  idSuffix: string;
  trackingValues: string[];
  conditions: ConditionInput[];
  onConditionsChange: (conditions: ConditionInput[]) => void;
  fineAmount: number | "";
  onFineAmountChange: (value: number | "") => void;
  rewardAmount: number | "";
  onRewardAmountChange: (value: number | "") => void;
  availableEmails: string[];
  alertEmails: string[];
  onAlertEmailsChange: (emails: string[]) => void;
  alertSubject: string;
  onAlertSubjectChange: (subject: string) => void;
  alertBody: string;
  onAlertBodyChange: (body: string) => void;
  onError: (message: string) => void;
}

const HabitConditionsEditor: React.FC<HabitConditionsEditorProps> = ({
  idSuffix,
  trackingValues,
  conditions,
  onConditionsChange,
  fineAmount,
  onFineAmountChange,
  rewardAmount,
  onRewardAmountChange,
  availableEmails,
  alertEmails,
  onAlertEmailsChange,
  alertSubject,
  onAlertSubjectChange,
  alertBody,
  onAlertBodyChange,
  onError,
}) => {
  const updateCondition = (index: number, patch: Partial<ConditionInput>) => {
    onConditionsChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const addCondition = () => {
    if (conditions.length >= MAX_CONDITIONS) {
      onError(`Maximum of ${MAX_CONDITIONS} conditions reached.`);
      return;
    }
    onConditionsChange([...conditions, emptyCondition()]);
  };

  const removeCondition = (index: number) => {
    onConditionsChange(conditions.filter((_, i) => i !== index));
  };

  const toggleAlertEmail = (email: string, checked: boolean) => {
    onAlertEmailsChange(checked ? [...alertEmails, email] : alertEmails.filter(e => e !== email));
  };

  const hasFineCondition = conditions.some(c => c.outcome === "fine");
  const hasRewardCondition = conditions.some(c => c.outcome === "reward");

  return (
    <>
      {/* Conditions */}
      <div className="w-full text-left">
        <label className="block text-sm font-medium text-gray-700 mb-2">Conditions</label>
        <div className="flex flex-col gap-3">
          {conditions.map((condition, index) => (
            <div key={index} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-700 text-sm">If</span>

                <select
                  className="flex-1 min-w-[9rem] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white text-sm"
                  value={condition.trackingValue}
                  onChange={(e) => updateCondition(index, { trackingValue: e.target.value })}
                >
                  <option value="" disabled>Select tracking value</option>
                  {trackingValues.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>

                <select
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, { operator: e.target.value as ConditionOperator })}
                >
                  {CONDITION_OPERATORS.map((op) => (
                    <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Number"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={condition.count}
                  onChange={(e) => updateCondition(index, { count: e.target.value === "" ? "" : Number(e.target.value) })}
                />

                <select
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  value={condition.frequency}
                  onChange={(e) => updateCondition(index, { frequency: e.target.value as ConditionFrequency })}
                >
                  {CONDITION_FREQUENCIES.map((freq) => (
                    <option key={freq} value={freq}>{FREQUENCY_LABELS[freq]}</option>
                  ))}
                </select>

                <span className="font-semibold text-gray-700 text-sm">then</span>

                <select
                  className={`w-32 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm font-medium ${
                    condition.outcome === "reward"
                      ? "border-green-300 bg-green-50 text-green-800 focus:ring-green-500"
                      : "border-red-300 bg-red-50 text-red-800 focus:ring-red-500"
                  }`}
                  value={condition.outcome}
                  onChange={(e) => updateCondition(index, { outcome: e.target.value as ConditionOutcome })}
                >
                  <option value="fine">Fine</option>
                  <option value="reward">Reward</option>
                </select>

                {conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="text-red-500 hover:text-red-700 focus:outline-none p-2 rounded-full hover:bg-red-100"
                    aria-label="Remove condition"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 w-full bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          onClick={addCondition}
        >
          + Add Another Condition
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Counts are of how many times that tracking value was recorded within the chosen period.
        </p>
      </div>

      {/* Fine section */}
      <div className={`w-full text-left p-3 rounded-lg border ${hasFineCondition ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
        <label className="block text-sm font-bold text-gray-800 mb-2">Fine</label>
        {!hasFineCondition && (
          <p className="text-xs text-gray-500 mb-2 italic">No condition above is set to "Fine" yet — these settings won't be used.</p>
        )}

        <label htmlFor={`fine-amount-${idSuffix}`} className="block text-xs font-medium text-gray-600">Fine Amount (₹)</label>
        <input
          type="number"
          id={`fine-amount-${idSuffix}`}
          placeholder="Enter amount in Rupees"
          className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
          value={fineAmount}
          onChange={(e) => onFineAmountChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <p className="text-xs text-gray-500 mt-1">Automatically added to the Fines &amp; Rewards page when a fine condition is met.</p>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600">Email these people when a fine is incurred</label>
          {availableEmails.length === 0 ? (
            <p className="text-xs text-gray-500 italic mt-1">
              No accountability emails defined yet. Add them on the Settings page first.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {availableEmails.map((email) => (
                <label key={email} className="inline-flex items-center bg-white border border-gray-200 px-3 py-1.5 rounded-full text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="form-checkbox rounded text-blue-600 focus:ring-blue-500 focus:ring-2 h-4 w-4 mr-2"
                    checked={alertEmails.includes(email)}
                    onChange={(e) => toggleAlertEmail(email, e.target.checked)}
                  />
                  {email}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor={`alert-subject-${idSuffix}`} className="block text-xs font-medium text-gray-600">Email Subject</label>
          <input
            type="text"
            id={`alert-subject-${idSuffix}`}
            placeholder={DEFAULT_ALERT_SUBJECT}
            className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            value={alertSubject}
            onChange={(e) => onAlertSubjectChange(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <label htmlFor={`alert-body-${idSuffix}`} className="block text-xs font-medium text-gray-600">Email Body</label>
          <textarea
            id={`alert-body-${idSuffix}`}
            rows={8}
            placeholder={DEFAULT_ALERT_BODY}
            className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full resize-y font-mono text-sm"
            value={alertBody}
            onChange={(e) => onAlertBodyChange(e.target.value)}
          />
          <p className="text-xs text-gray-600 mt-2">Click a tag to insert it into the body:</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {EMAIL_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onAlertBodyChange(`${alertBody}${tag}`)}
                className="bg-white border border-gray-300 text-gray-700 text-xs font-mono px-2 py-0.5 rounded hover:bg-blue-50 hover:border-blue-400"
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Leave subject or body blank to use the default wording.
          </p>
        </div>
      </div>

      {/* Reward section */}
      <div className={`w-full text-left p-3 rounded-lg border ${hasRewardCondition ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
        <label className="block text-sm font-bold text-gray-800 mb-2">Reward</label>
        {!hasRewardCondition && (
          <p className="text-xs text-gray-500 mb-2 italic">No condition above is set to "Reward" yet — this amount won't be used.</p>
        )}
        <label htmlFor={`reward-amount-${idSuffix}`} className="block text-xs font-medium text-gray-600">Reward Amount (₹)</label>
        <input
          type="number"
          id={`reward-amount-${idSuffix}`}
          placeholder="Enter amount in Rupees"
          className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
          value={rewardAmount}
          onChange={(e) => onRewardAmountChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <p className="text-xs text-gray-500 mt-1">
          Automatically added to the Fines &amp; Rewards page when a reward condition is met. No email is sent for rewards.
        </p>
      </div>
    </>
  );
};

export default HabitConditionsEditor;
