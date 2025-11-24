'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box } from '@twilio-paste/core/box';
import { Heading } from '@twilio-paste/core/heading';
import { Card } from '@twilio-paste/core/card';
import { Text } from '@twilio-paste/core/text';
import { Grid, Column } from '@twilio-paste/core/grid';
import { Stack } from '@twilio-paste/core/stack';
import { Spinner } from '@twilio-paste/core/spinner';
import { Alert } from '@twilio-paste/core/alert';
import { Badge } from '@twilio-paste/core/badge';
import { Separator } from '@twilio-paste/core/separator';

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

export default function Home() {
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      setLoading(false);
    }
  };

  return (
    <Box padding="space100" minHeight="100vh">
      <Box maxWidth="size100" marginLeft="auto" marginRight="auto">
        <Stack orientation="vertical" spacing="space80">
          <Heading as="h1" variant="heading10">
            Launtel Plan Manager
          </Heading>

          {loading ? (
            <Box display="flex" justifyContent="center" padding="space100">
              <Stack orientation="horizontal" spacing="space40">
                <Spinner decorative={false} title="Loading current plan" />
                <Text as="span">Loading current plan...</Text>
              </Stack>
            </Box>
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

          <Grid gutter="space60" vertical={[true, false, false]}>
            <Column>
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <Card padding="space70">
                  <Stack orientation="vertical" spacing="space40">
                    <Heading as="h2" variant="heading30">
                      Dashboard
                    </Heading>
                    <Text as="p" color="colorTextWeak">
                      View current plan and trigger plan changes
                    </Text>
                  </Stack>
                </Card>
              </Link>
            </Column>

            <Column>
              <Link href="/logs" style={{ textDecoration: 'none' }}>
                <Card padding="space70">
                  <Stack orientation="vertical" spacing="space40">
                    <Heading as="h2" variant="heading30">
                      Logs
                    </Heading>
                    <Text as="p" color="colorTextWeak">
                      View history of plan changes and system logs
                    </Text>
                  </Stack>
                </Card>
              </Link>
            </Column>

            <Column>
              <Link href="/schedule" style={{ textDecoration: 'none' }}>
                <Card padding="space70">
                  <Stack orientation="vertical" spacing="space40">
                    <Heading as="h2" variant="heading30">
                      Schedule
                    </Heading>
                    <Text as="p" color="colorTextWeak">
                      Schedule automatic plan changes
                    </Text>
                  </Stack>
                </Card>
              </Link>
            </Column>

            <Column>
              <Link href="/settings" style={{ textDecoration: 'none' }}>
                <Card padding="space70">
                  <Stack orientation="vertical" spacing="space40">
                    <Heading as="h2" variant="heading30">
                      Settings
                    </Heading>
                    <Text as="p" color="colorTextWeak">
                      Configure Launtel credentials and parameters
                    </Text>
                  </Stack>
                </Card>
              </Link>
            </Column>
          </Grid>
        </Stack>
      </Box>
    </Box>
  )
}
