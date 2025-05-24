// src/components/hangouts/HangoutRequestForm.tsx
'use client';

import React, { useState } from 'react';
import { HangoutRequestFormData, DateRange, TimeRange } from '@/types/hangouts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Assuming you have this for multi-line description if needed
import { XCircleIcon, PlusCircleIcon } from '@heroicons/react/24/solid'; // Or any other icons

// Helper to format Date to 'yyyy-MM-dd' for date input
const formatDateForDateInput = (date: Date | undefined | null): string => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
};


interface HangoutRequestFormProps {
  onSave: (formData: HangoutRequestFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<HangoutRequestFormData>; // For editing later, not used now
}

const HangoutRequestForm: React.FC<HangoutRequestFormProps> = ({
  onSave,
  onCancel,
  isLoading = false,
  initialData,
}) => {
  const [requestName, setRequestName] = useState(initialData?.requestName || '');
  const [dateRanges, setDateRanges] = useState<DateRange[]>(
    initialData?.dateRanges || [{ start: new Date(), end: new Date() }]
  );
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>(
    initialData?.timeRanges || [{ start: '09:00', end: '17:00' }]
  );
  const [desiredDurationMinutes, setDesiredDurationMinutes] = useState(
    initialData?.desiredDurationMinutes || 60
  );
  const [desiredMarginMinutes, setDesiredMarginMinutes] = useState(
    initialData?.desiredMarginMinutes || 0
  );
  const [desiredMemberCount, setDesiredMemberCount] = useState(
    initialData?.desiredMemberCount || 2
  );

  const handleDateRangeChange = (index: number, field: keyof DateRange, value: string) => {
    const newDateRanges = [...dateRanges];
    // When changing a date string, preserve the time part if it exists, or set to start/end of day.
    const currentDate = newDateRanges[index][field] || new Date();
    const newDate = new Date(value); // This will be midnight UTC
    
    // Preserve time from existing date, apply new YYYY-MM-DD
    const updatedDate = new Date(currentDate);
    updatedDate.setFullYear(newDate.getUTCFullYear());
    updatedDate.setMonth(newDate.getUTCMonth());
    updatedDate.setDate(newDate.getUTCDate());

    newDateRanges[index] = { ...newDateRanges[index], [field]: updatedDate };
    setDateRanges(newDateRanges);
  };

  const addDateRange = () => setDateRanges([...dateRanges, { start: new Date(), end: new Date() }]);
  const removeDateRange = (index: number) => setDateRanges(dateRanges.filter((_, i) => i !== index));

  const handleTimeRangeChange = (index: number, field: keyof TimeRange, value: string) => {
    const newTimeRanges = [...timeRanges];
    newTimeRanges[index] = { ...newTimeRanges[index], [field]: value };
    setTimeRanges(newTimeRanges);
  };

  const addTimeRange = () => setTimeRanges([...timeRanges, { start: '09:00', end: '17:00' }]);
  const removeTimeRange = (index: number) => setTimeRanges(timeRanges.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestName.trim()) { alert("Request Name is required."); return; }
    if (dateRanges.some(dr => !dr.start || !dr.end || new Date(dr.end) < new Date(dr.start))) {
        alert("All date ranges must have a valid start and end, with end after start."); return;
    }
    if (timeRanges.some(tr => !tr.start || !tr.end || tr.end <= tr.start)) {
        alert("All time ranges must have a valid start and end, with end after start (e.g., 09:00 to 17:00)."); return;
    }
    if (desiredDurationMinutes <= 0) { alert("Duration must be positive."); return; }
    if (desiredMemberCount < 2) { alert("Member count must be at least 2."); return; }

    await onSave({
      requestName,
      dateRanges,
      timeRanges,
      desiredDurationMinutes,
      desiredMarginMinutes,
      desiredMemberCount,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1 max-h-[80vh] overflow-y-auto">
      <div>
        <Label htmlFor="requestName">Request Name</Label>
        <Input id="requestName" value={requestName} onChange={(e) => setRequestName(e.target.value)} required />
      </div>

      {/* Date Ranges */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label>Date Ranges (when can people meet?)</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addDateRange} className="text-blue-600">
            <PlusCircleIcon className="h-5 w-5 mr-1" /> Add Date Range
          </Button>
        </div>
        {dateRanges.map((range, index) => (
          <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
            <div className="flex-1">
              <Label htmlFor={`dateRange-start-${index}`}>From</Label>
              <Input
                id={`dateRange-start-${index}`}
                type="date"
                value={formatDateForDateInput(range.start)}
                onChange={(e) => handleDateRangeChange(index, 'start', e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor={`dateRange-end-${index}`}>To</Label>
              <Input
                id={`dateRange-end-${index}`}
                type="date"
                value={formatDateForDateInput(range.end)}
                onChange={(e) => handleDateRangeChange(index, 'end', e.target.value)}
                required
              />
            </div>
            {dateRanges.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeDateRange(index)} className="mt-5 text-red-500">
                <XCircleIcon className="h-6 w-6" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Time Ranges */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label>Time Ranges (within each selected day)</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addTimeRange} className="text-blue-600">
             <PlusCircleIcon className="h-5 w-5 mr-1" /> Add Time Range
          </Button>
        </div>
        {timeRanges.map((range, index) => (
          <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
            <div className="flex-1">
              <Label htmlFor={`timeRange-start-${index}`}>From</Label>
              <Input
                id={`timeRange-start-${index}`}
                type="time"
                value={range.start}
                onChange={(e) => handleTimeRangeChange(index, 'start', e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor={`timeRange-end-${index}`}>To</Label>
              <Input
                id={`timeRange-end-${index}`}
                type="time"
                value={range.end}
                onChange={(e) => handleTimeRangeChange(index, 'end', e.target.value)}
                required
              />
            </div>
            {timeRanges.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeTimeRange(index)} className="mt-5 text-red-500">
                <XCircleIcon className="h-6 w-6" />
              </Button>
            )}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <Label htmlFor="desiredDuration">Desired Duration (minutes)</Label>
            <Input id="desiredDuration" type="number" min="15" step="15" value={desiredDurationMinutes} onChange={(e) => setDesiredDurationMinutes(parseInt(e.target.value, 10))} required />
        </div>
        <div>
            <Label htmlFor="desiredMargin">Buffer/Margin (minutes before/after)</Label>
            <Input id="desiredMargin" type="number" min="0" step="5" value={desiredMarginMinutes} onChange={(e) => setDesiredMarginMinutes(parseInt(e.target.value, 10))} required />
        </div>
      </div>

      <div>
        <Label htmlFor="desiredMemberCount">Desired Number of Members</Label>
        <Input id="desiredMemberCount" type="number" min="2" value={desiredMemberCount} onChange={(e) => setDesiredMemberCount(parseInt(e.target.value, 10))} required />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" isLoading={isLoading} disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Request'}
        </Button>
      </div>
    </form>
  );
};

export default HangoutRequestForm;