'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box } from '@twilio-paste/core/box';
import { Heading } from '@twilio-paste/core/heading';
import { Card } from '@twilio-paste/core/card';
import { Text } from '@twilio-paste/core/text';
import { Button } from '@twilio-paste/core/button';
import { Alert } from '@twilio-paste/core/alert';
import { Stack } from '@twilio-paste/core/stack';
import { Label } from '@twilio-paste/core/label';
import { Input } from '@twilio-paste/core/input';
import { Select, Option } from '@twilio-paste/core/select';
import { Grid, Column } from '@twilio-paste/core/grid';
import { Spinner } from '@twilio-paste/core/spinner';
import { Separator } from '@twilio-paste/core/separator';
import { Switch } from '@twilio-paste/core/switch';

interface Plan {
  name: string;
  psid: number;
}

interface Schedule {
  id: number;
  planName: string;
  psid: string;
  hour: number;
  minute: number;
  timezone: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SchedulePage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [browserTimezone, setBrowserTimezone] = useState<string>('UTC');
  const [formData, setFormData] = useState({
    psid: '',
    hour: '23',
    minute: '45',
    timezone: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Detect browser timezone on mount
  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setBrowserTimezone(detectedTimezone);
    setFormData(prev => ({ ...prev, timezone: detectedTimezone }));
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, schedulesRes] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/schedules'),
      ]);

      const plansData = await plansRes.json();
      const schedulesData = await schedulesRes.json();

      setPlans(plansData.plans || []);
      setSchedules(schedulesData.schedules || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const selectedPlan = plans.find(p => p.psid === parseInt(formData.psid));
    if (!selectedPlan) return;

    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: selectedPlan.name,
          psid: formData.psid,
          hour: parseInt(formData.hour),
          minute: parseInt(formData.minute),
          timezone: formData.timezone || browserTimezone,
          enabled: true,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: data.message });
        setShowForm(false);
        setFormData({ psid: '', hour: '23', minute: '45', timezone: browserTimezone });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create schedule' });
    }
  };

  const handleToggleEnabled = async (id: number, enabled: boolean) => {
    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
        setMessage({ type: 'success', text: 'Schedule deleted successfully' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete schedule' });
    }
  };

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const formatTimezone = (timezone: string) => {
    // Show short timezone abbreviation if possible
    try {
      const date = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short',
      });
      const parts = formatter.formatToParts(date);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart?.value || timezone;
    } catch {
      return timezone;
    }
  };

  if (loading) {
    return (
      <Box padding="space100" minHeight="100vh" display="flex" justifyContent="center" alignItems="center">
        <Stack orientation="horizontal" spacing="space40">
          <Spinner decorative={false} title="Loading schedules" />
          <Text as="span">Loading schedules...</Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box padding="space100" minHeight="100vh">
      <Box maxWidth="size80" marginLeft="auto" marginRight="auto">
        <Stack orientation="vertical" spacing="space80">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Heading as="h1" variant="heading10">
              Schedule Management
            </Heading>
            <Stack orientation="horizontal" spacing="space40">
              <Button onClick={() => setShowForm(!showForm)} variant="primary">
                {showForm ? 'Cancel' : '+ Add Schedule'}
              </Button>
              <Link href="/">
                <Button as="span" variant="link">
                  ← Back to Home
                </Button>
              </Link>
            </Stack>
          </Box>

          {message && (
            <Alert variant={message.type === 'success' ? 'neutral' : 'error'}>
              <Text as="span">{message.text}</Text>
            </Alert>
          )}

          {showForm && (
            <Card>
              <form onSubmit={handleSubmit}>
                <Stack orientation="vertical" spacing="space80">
                  <Heading as="h2" variant="heading20">
                    Add New Schedule
                  </Heading>

                  <Box>
                    <Label htmlFor="plan" required>
                      Plan
                    </Label>
                    <Select
                      id="plan"
                      name="plan"
                      value={formData.psid}
                      onChange={(e) => setFormData({ ...formData, psid: e.target.value })}
                      required
                    >
                      <Option value="">Select a plan...</Option>
                      {plans.map((plan) => (
                        <Option key={plan.psid} value={plan.psid.toString()}>
                          {plan.name} (PSID: {plan.psid})
                        </Option>
                      ))}
                    </Select>
                  </Box>

                  <Grid gutter="space60">
                    <Column>
                      <Label htmlFor="hour" required>
                        Hour (0-23)
                      </Label>
                      <Input
                        id="hour"
                        name="hour"
                        type="number"
                        min="0"
                        max="23"
                        value={formData.hour}
                        onChange={(e) => setFormData({ ...formData, hour: e.target.value })}
                        required
                      />
                    </Column>

                    <Column>
                      <Label htmlFor="minute" required>
                        Minute (0-59)
                      </Label>
                      <Input
                        id="minute"
                        name="minute"
                        type="number"
                        min="0"
                        max="59"
                        value={formData.minute}
                        onChange={(e) => setFormData({ ...formData, minute: e.target.value })}
                        required
                      />
                    </Column>
                  </Grid>

                  <Box>
                    <Label htmlFor="timezone" required>
                      Timezone
                    </Label>
                    <Input
                      id="timezone"
                      name="timezone"
                      type="text"
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      placeholder={browserTimezone}
                      required
                    />
                    <Text as="p" fontSize="fontSize20" color="colorTextWeak" marginTop="space20">
                      Detected: {browserTimezone}. You can use any valid IANA timezone (e.g., America/New_York, Europe/London, Asia/Tokyo)
                    </Text>
                  </Box>

                  <Box>
                    <Button type="submit" variant="primary" fullWidth>
                      Create Schedule
                    </Button>
                  </Box>
                </Stack>
              </form>
            </Card>
          )}

          <Card>
            <Stack orientation="vertical" spacing="space80">
              <Heading as="h2" variant="heading20">
                Scheduled Plan Changes
              </Heading>

              {schedules.length === 0 ? (
                <Box padding="space80" textAlign="center">
                  <Text as="p" color="colorTextWeak">
                    No schedules configured. Click "Add Schedule" to create one.
                  </Text>
                </Box>
              ) : (
                <Stack orientation="vertical" spacing="space60">
                  {schedules.map((schedule, index) => (
                    <Box key={schedule.id}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" padding="space60">
                        <Box display="flex" alignItems="center" columnGap="space60">
                          <Box>
                            <Text as="div" fontSize="fontSize70" fontWeight="fontWeightBold" color="colorTextBrandHighlight">
                              {formatTime(schedule.hour, schedule.minute)}
                            </Text>
                            <Text as="div" fontSize="fontSize10" color="colorTextWeak" textAlign="center">
                              {formatTimezone(schedule.timezone)}
                            </Text>
                          </Box>
                          <Box>
                            <Text as="div" fontWeight="fontWeightSemibold">
                              {schedule.planName}
                            </Text>
                            <Text as="div" fontSize="fontSize20" color="colorTextWeak">
                              PSID: {schedule.psid} • {schedule.timezone}
                            </Text>
                          </Box>
                        </Box>

                        <Box display="flex" alignItems="center" columnGap="space30">
                          <Switch
                            checked={schedule.enabled}
                            onChange={() => handleToggleEnabled(schedule.id, schedule.enabled)}
                          >
                            {schedule.enabled ? 'Enabled' : 'Disabled'}
                          </Switch>

                          <Button
                            onClick={() => handleDelete(schedule.id)}
                            variant="destructive_secondary"
                            size="small"
                          >
                            Delete
                          </Button>
                        </Box>
                      </Box>
                      {index < schedules.length - 1 && <Separator orientation="horizontal" />}
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>

          <Alert variant="neutral">
            <Stack orientation="vertical" spacing="space30">
              <Heading as="h3" variant="heading50">
                How it works:
              </Heading>
              <Text as="p" fontSize="fontSize30">
                The scheduler checks every minute for scheduled plan changes. Each schedule runs in its configured timezone,
                so a schedule set for 23:45 in America/New_York will execute at 23:45 Eastern time regardless of the server timezone.
                All scheduled changes are logged and can be viewed in the Logs page.
              </Text>
            </Stack>
          </Alert>
        </Stack>
      </Box>
    </Box>
  );
}
