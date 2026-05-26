'use client';

import React, { useState } from 'react';
import { HangoutRequestFormData, DateRangeClient, TimeRange } from '@/types/hangouts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { XCircleIcon, PlusCircleIcon } from '@heroicons/react/24/solid';
import { useLanguage } from '@/hooks/useLanguage';

const formatDateForDateInput = (date: Date | undefined | null): string => {
  if (!date) return '';
  const tempDate = new Date(date);
  const offset = tempDate.getTimezoneOffset();
  const localizedDate = new Date(tempDate.getTime() - offset * 60 * 1000);
  return localizedDate.toISOString().split('T')[0];
};

interface HangoutRequestFormProps {
  onSave: (formData: HangoutRequestFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<HangoutRequestFormData>;
}

const HangoutRequestForm: React.FC<HangoutRequestFormProps> = ({
  onSave,
  onCancel,
  isLoading = false,
  initialData,
}) => {
  const [requestName, setRequestName] = useState(initialData?.requestName || '');
  const [dateRanges, setDateRanges] = useState<DateRangeClient[]>(
    initialData?.dateRanges || [{ start: new Date(), end: new Date() }],
  );
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>(
    initialData?.timeRanges || [{ start: '09:00', end: '17:00' }],
  );
  const [desiredDurationMinutes, setDesiredDurationMinutes] = useState(
    initialData?.desiredDurationMinutes || 60,
  );
  const [desiredMarginMinutes, setDesiredMarginMinutes] = useState(initialData?.desiredMarginMinutes || 0);
  const [desiredMemberCount, setDesiredMemberCount] = useState(initialData?.desiredMemberCount || 2);
  const { t } = useLanguage();

  const handleDateRangeChange = (index: number, field: keyof DateRangeClient, value: string) => {
    const newDateRanges = [...dateRanges];
    const newDateFromInput = new Date(value + 'T00:00:00');
    newDateRanges[index] = { ...newDateRanges[index], [field]: newDateFromInput };
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
    if (!requestName.trim()) {
      alert(t.forms.titleRequired);
      return;
    }
    if (dateRanges.some((dr) => !dr.start || !dr.end || new Date(dr.end) < new Date(dr.start))) {
      alert('日付範囲には有効な開始日と終了日が必要です。終了日は開始日と同日かそれ以降にしてください。');
      return;
    }
    if (timeRanges.some((tr) => !tr.start || !tr.end || tr.end <= tr.start)) {
      alert('時間帯には有効な開始時刻と終了時刻が必要です。終了時刻は開始時刻より後にしてください（例: 09:00 から 17:00）。');
      return;
    }
    if (desiredDurationMinutes <= 0) {
      alert('所要時間は 1 以上にしてください。');
      return;
    }
    if (desiredMemberCount < 2) {
      alert('参加人数は 2 人以上にしてください。');
      return;
    }

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
    <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-6 overflow-y-auto p-1">
      <div>
        <Label htmlFor="requestName">{t.forms.requestName}</Label>
        <Input id="requestName" value={requestName} onChange={(e) => setRequestName(e.target.value)} required />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t.forms.dateRanges}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addDateRange} className="text-blue-600">
            <PlusCircleIcon className="mr-1 h-5 w-5" /> {t.forms.addDateRange}
          </Button>
        </div>
        {dateRanges.map((range, index) => (
          <div key={index} className="flex items-center gap-2 rounded-md border p-2">
            <div className="flex-1">
              <Label htmlFor={`dateRange-start-${index}`}>{t.forms.from}</Label>
              <Input
                id={`dateRange-start-${index}`}
                type="date"
                value={formatDateForDateInput(range.start)}
                onChange={(e) => handleDateRangeChange(index, 'start', e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor={`dateRange-end-${index}`}>{t.forms.to}</Label>
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t.forms.timeRanges}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addTimeRange} className="text-blue-600">
            <PlusCircleIcon className="mr-1 h-5 w-5" /> {t.forms.addTimeRange}
          </Button>
        </div>
        {timeRanges.map((range, index) => (
          <div key={index} className="flex items-center gap-2 rounded-md border p-2">
            <div className="flex-1">
              <Label htmlFor={`timeRange-start-${index}`}>{t.forms.from}</Label>
              <Input
                id={`timeRange-start-${index}`}
                type="time"
                value={range.start}
                onChange={(e) => handleTimeRangeChange(index, 'start', e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor={`timeRange-end-${index}`}>{t.forms.to}</Label>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="desiredDuration">{t.forms.desiredDuration}</Label>
          <Input id="desiredDuration" type="number" min="15" step="15" value={desiredDurationMinutes} onChange={(e) => setDesiredDurationMinutes(parseInt(e.target.value, 10))} required />
        </div>
        <div>
          <Label htmlFor="desiredMargin">{t.forms.desiredMargin}</Label>
          <Input id="desiredMargin" type="number" min="0" step="5" value={desiredMarginMinutes} onChange={(e) => setDesiredMarginMinutes(parseInt(e.target.value, 10))} required />
        </div>
      </div>

      <div>
        <Label htmlFor="desiredMemberCount">{t.forms.desiredMemberCount}</Label>
        <Input id="desiredMemberCount" type="number" min="2" value={desiredMemberCount} onChange={(e) => setDesiredMemberCount(parseInt(e.target.value, 10))} required />
      </div>

      <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t.common.cancel}
        </Button>
        <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" isLoading={isLoading} disabled={isLoading}>
          {isLoading ? t.forms.creating : t.forms.createRequest}
        </Button>
      </div>
    </form>
  );
};

export default HangoutRequestForm;
