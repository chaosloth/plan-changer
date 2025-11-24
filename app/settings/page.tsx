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
import { HelpText } from '@twilio-paste/core/help-text';
import { Grid, Column } from '@twilio-paste/core/grid';
import { Disclosure, DisclosureHeading, DisclosureContent } from '@twilio-paste/core/disclosure';
import { Spinner } from '@twilio-paste/core/spinner';

interface Settings {
  base: string;
  username: string;
  password: string;
  userId: string;
  serviceId: string;
  avcId: string;
  locId: string;
  discountCode?: string;
  unpause?: string;
  coat?: string;
  churn?: string;
  scheduledDt?: string;
  newServicePaymentOption?: string;
  timeoutMs?: number;
  hasPassword?: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    base: 'https://residential.launtel.net.au',
    username: '',
    password: '',
    userId: '',
    serviceId: '',
    avcId: '',
    locId: '',
    discountCode: '',
    unpause: '0',
    coat: '0',
    churn: '0',
    scheduledDt: '',
    newServicePaymentOption: '',
    timeoutMs: 15000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (data.settings) {
        setSettings({
          ...data.settings,
          password: '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Settings, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Box padding="space100" minHeight="100vh" display="flex" justifyContent="center" alignItems="center">
        <Stack orientation="horizontal" spacing="space40">
          <Spinner decorative={false} title="Loading settings" />
          <Text as="span">Loading settings...</Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box padding="space100" minHeight="100vh">
      <Box maxWidth="size70" marginLeft="auto" marginRight="auto">
        <Stack orientation="vertical" spacing="space80">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Heading as="h1" variant="heading10">
              Settings
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

          <Card>
            <form onSubmit={handleSubmit}>
              <Stack orientation="vertical" spacing="space80">
                <Heading as="h2" variant="heading20">
                  Launtel Configuration
                </Heading>

                <Box>
                  <Label htmlFor="base" required>
                    Base URL
                  </Label>
                  <Input
                    id="base"
                    name="base"
                    type="url"
                    value={settings.base}
                    onChange={(e) => handleChange('base', e.target.value)}
                    required
                  />
                </Box>

                <Box>
                  <Label htmlFor="username" required>
                    Username
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={settings.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    required
                  />
                </Box>

                <Box>
                  <Label htmlFor="password" required={!settings.hasPassword}>
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={settings.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder={settings.hasPassword ? '••••••••' : ''}
                    required={!settings.hasPassword}
                  />
                  {settings.hasPassword && (
                    <HelpText>Password already set. Leave blank to keep current password.</HelpText>
                  )}
                </Box>

                <Grid gutter="space60">
                  <Column>
                    <Label htmlFor="userId" required>
                      User ID
                    </Label>
                    <Input
                      id="userId"
                      name="userId"
                      type="text"
                      value={settings.userId}
                      onChange={(e) => handleChange('userId', e.target.value)}
                      required
                    />
                  </Column>

                  <Column>
                    <Label htmlFor="serviceId" required>
                      Service ID
                    </Label>
                    <Input
                      id="serviceId"
                      name="serviceId"
                      type="text"
                      value={settings.serviceId}
                      onChange={(e) => handleChange('serviceId', e.target.value)}
                      required
                    />
                  </Column>
                </Grid>

                <Grid gutter="space60">
                  <Column>
                    <Label htmlFor="avcId" required>
                      AVC ID
                    </Label>
                    <Input
                      id="avcId"
                      name="avcId"
                      type="text"
                      value={settings.avcId}
                      onChange={(e) => handleChange('avcId', e.target.value)}
                      required
                    />
                  </Column>

                  <Column>
                    <Label htmlFor="locId" required>
                      Location ID
                    </Label>
                    <Input
                      id="locId"
                      name="locId"
                      type="text"
                      value={settings.locId}
                      onChange={(e) => handleChange('locId', e.target.value)}
                      required
                    />
                  </Column>
                </Grid>

                <Disclosure variant="contained">
                  <DisclosureHeading as="h3" variant="heading40">
                    Optional Settings
                  </DisclosureHeading>
                  <DisclosureContent>
                    <Stack orientation="vertical" spacing="space60">
                      <Box>
                        <Label htmlFor="discountCode">
                          Discount Code
                        </Label>
                        <Input
                          id="discountCode"
                          name="discountCode"
                          type="text"
                          value={settings.discountCode || ''}
                          onChange={(e) => handleChange('discountCode', e.target.value)}
                        />
                      </Box>

                      <Box>
                        <Label htmlFor="timeoutMs">
                          Timeout (ms)
                        </Label>
                        <Input
                          id="timeoutMs"
                          name="timeoutMs"
                          type="number"
                          value={settings.timeoutMs?.toString() || '15000'}
                          onChange={(e) => handleChange('timeoutMs', parseInt(e.target.value))}
                        />
                      </Box>
                    </Stack>
                  </DisclosureContent>
                </Disclosure>

                <Box>
                  <Button
                    type="submit"
                    disabled={saving}
                    variant="primary"
                    fullWidth
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </Box>
              </Stack>
            </form>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}
