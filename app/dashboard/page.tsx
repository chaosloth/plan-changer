'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box } from '@twilio-paste/core/box';
import { Heading } from '@twilio-paste/core/heading';
import { Card } from '@twilio-paste/core/card';
import { Text } from '@twilio-paste/core/text';
import { Button } from '@twilio-paste/core/button';
import { RadioGroup, Radio } from '@twilio-paste/core/radio-group';
import { Alert } from '@twilio-paste/core/alert';
import { Stack } from '@twilio-paste/core/stack';
import { Grid, Column } from '@twilio-paste/core/grid';
import { Spinner } from '@twilio-paste/core/spinner';
import { Badge } from '@twilio-paste/core/badge';
import { Separator } from '@twilio-paste/core/separator';

interface Plan {
  name: string;
  psid: number;
}

interface CurrentPlan {
  success: boolean;
  service?: {
    name: string;
    status: string;
    speedTier: string;
    dailyPrice: string;
    address: string;
    ipv4: string;
    ipv6Prefix: string;
  };
  balance?: {
    current: string;
    todayCharge: string;
    tomorrowCharge: string;
    daysRemaining: string;
  };
  error?: string;
}

export default function Dashboard() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [selectedPsid, setSelectedPsid] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetch('/api/current-plan');
      const data = await response.json();
      setCurrentPlan(data);
    } catch (error) {
      console.error('Failed to fetch current plan:', error);
      setCurrentPlan({ success: false, error: 'Failed to load current plan' });
    } finally {
      setLoadingCurrent(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/plans');
      const data = await response.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  const handlePlanChange = async () => {
    if (!selectedPsid) {
      setMessage({ type: 'error', text: 'Please select a plan' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/plans/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ psid: parseInt(selectedPsid) }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: data.message });
        // Refresh current plan after successful change
        fetchCurrentPlan();
      } else {
        setMessage({ type: 'error', text: data.error || data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change plan' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box padding="space100" minHeight="100vh">
      <Box maxWidth="size80" marginLeft="auto" marginRight="auto">
        <Stack orientation="vertical" spacing="space80">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Heading as="h1" variant="heading10">
              Dashboard
            </Heading>
            <Link href="/">
              <Button as="span" variant="link">
                ← Back to Home
              </Button>
            </Link>
          </Box>

          {message && (
            <Alert variant={message.type === 'success' ? 'neutral' : 'error'}>
              <Text as="span">{message.text}</Text>
            </Alert>
          )}

          {loadingCurrent ? (
            <Card>
              <Box display="flex" justifyContent="center" padding="space80">
                <Stack orientation="horizontal" spacing="space40">
                  <Spinner decorative={false} title="Loading current plan" />
                  <Text as="span">Loading current plan...</Text>
                </Stack>
              </Box>
            </Card>
          ) : currentPlan?.success && currentPlan.service && currentPlan.balance ? (
            <Card>
              <Stack orientation="vertical" spacing="space60">
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Heading as="h2" variant="heading20">
                    Current Plan
                  </Heading>
                  <Badge as="span" variant="neutral">{currentPlan.service.status}</Badge>
                </Box>

                <Separator orientation="horizontal" />

                <Grid gutter="space60">
                  <Column span={6}>
                    <Stack orientation="vertical" spacing="space40">
                      <Box>
                        <Text as="div" fontSize="fontSize20" color="colorTextWeak">
                          Service
                        </Text>
                        <Text as="div" fontSize="fontSize40" fontWeight="fontWeightBold">
                          {currentPlan.service.name}
                        </Text>
                      </Box>

                      <Box>
                        <Text as="div" fontSize="fontSize20" color="colorTextWeak">
                          Speed Tier
                        </Text>
                        <Text as="div" fontSize="fontSize30" fontWeight="fontWeightSemibold">
                          {currentPlan.service.speedTier}
                        </Text>
                      </Box>

                      <Box>
                        <Text as="div" fontSize="fontSize20" color="colorTextWeak">
                          Daily Price
                        </Text>
                        <Text as="div" fontSize="fontSize30" fontWeight="fontWeightSemibold" color="colorTextBrandHighlight">
                          {currentPlan.service.dailyPrice}
                        </Text>
                      </Box>
                    </Stack>
                  </Column>

                  <Column span={6}>
                    <Stack orientation="vertical" spacing="space40">
                      <Box>
                        <Text as="div" fontSize="fontSize20" color="colorTextWeak">
                          Current Balance
                        </Text>
                        <Text as="div" fontSize="fontSize40" fontWeight="fontWeightBold">
                          {currentPlan.balance.current}
                        </Text>
                      </Box>

                      <Box>
                        <Text as="div" fontSize="fontSize20" color="colorTextWeak">
                          Today's Charge
                        </Text>
                        <Text as="div" fontSize="fontSize30">
                          {currentPlan.balance.todayCharge}
                        </Text>
                      </Box>

                      <Box>
                        <Text as="div" fontSize="fontSize20" color="colorTextWeak">
                          Estimated Days Remaining
                        </Text>
                        <Text as="div" fontSize="fontSize30" fontWeight="fontWeightSemibold">
                          {currentPlan.balance.daysRemaining}
                        </Text>
                      </Box>
                    </Stack>
                  </Column>
                </Grid>
              </Stack>
            </Card>
          ) : currentPlan?.error ? (
            <Alert variant="warning">
              <Text as="span">{currentPlan.error}</Text>
            </Alert>
          ) : null}

          <Card>
            <Stack orientation="vertical" spacing="space80">
              <Heading as="h2" variant="heading20">
                Change Plan
              </Heading>
              <Text as="p" color="colorTextWeak">
                Select a plan below and click "Change Plan" to trigger an immediate plan change.
              </Text>
              <RadioGroup
                name="plan"
                legend="Available Plans"
                value={selectedPsid}
                onChange={(value) => setSelectedPsid(value)}
              >
                {plans.map((plan) => (
                  <Radio
                    key={plan.psid}
                    id={`plan-${plan.psid}`}
                    value={plan.psid.toString()}
                    helpText={`PSID: ${plan.psid}`}
                  >
                    {plan.name}
                  </Radio>
                ))}
              </RadioGroup>

              <Box>
                <Button
                  onClick={handlePlanChange}
                  disabled={loading || !selectedPsid}
                  variant="primary"
                  fullWidth
                >
                  {loading ? 'Changing Plan...' : 'Change Plan Now'}
                </Button>
              </Box>
            </Stack>
          </Card>

          <Grid gutter="space60">
            <Column>
              <Link href="/logs" style={{ textDecoration: 'none' }}>
                <Card>
                  <Stack orientation="vertical" spacing="space40">
                    <Heading as="h3" variant="heading40">
                      View Logs
                    </Heading>
                    <Text as="p" color="colorTextWeak">
                      Check the history of plan changes
                    </Text>
                  </Stack>
                </Card>
              </Link>
            </Column>

            <Column>
              <Link href="/schedule" style={{ textDecoration: 'none' }}>
                <Card>
                  <Stack orientation="vertical" spacing="space40">
                    <Heading as="h3" variant="heading40">
                      Manage Schedule
                    </Heading>
                    <Text as="p" color="colorTextWeak">
                      Set up automatic plan changes
                    </Text>
                  </Stack>
                </Card>
              </Link>
            </Column>
          </Grid>
        </Stack>
      </Box>
    </Box>
  );
}
