'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box } from '@twilio-paste/core/box';
import { Heading } from '@twilio-paste/core/heading';
import { Card } from '@twilio-paste/core/card';
import { Text } from '@twilio-paste/core/text';
import { Button } from '@twilio-paste/core/button';
import { Stack } from '@twilio-paste/core/stack';
import { Table, THead, TBody, Tr, Th, Td } from '@twilio-paste/core/table';
import { Badge } from '@twilio-paste/core/badge';
import { Spinner } from '@twilio-paste/core/spinner';

interface Log {
  id: number;
  success: boolean;
  message: string;
  planName?: string;
  psid?: string;
  timestamp: string;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/logs');
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      return;
    }

    setClearing(true);
    try {
      const response = await fetch('/api/logs', {
        method: 'DELETE',
      });

      if (response.ok) {
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
      alert('Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <Box padding="space100" minHeight="100vh" display="flex" justifyContent="center" alignItems="center">
        <Stack orientation="horizontal" spacing="space40">
          <Spinner decorative={false} title="Loading logs" />
          <Text as="span">Loading logs...</Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box padding="space100" minHeight="100vh">
      <Box maxWidth="size100" marginLeft="auto" marginRight="auto">
        <Stack orientation="vertical" spacing="space80">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Heading as="h1" variant="heading10">
              Logs
            </Heading>
            <Stack orientation="horizontal" spacing="space40">
              <Button
                onClick={handleClearLogs}
                disabled={clearing || logs.length === 0}
                variant="destructive"
              >
                {clearing ? 'Clearing...' : 'Clear Logs'}
              </Button>
              <Link href="/">
                <Button as="span" variant="link">
                  ← Back to Home
                </Button>
              </Link>
            </Stack>
          </Box>

          {logs.length === 0 ? (
            <Card>
              <Box padding="space80" textAlign="center">
                <Text as="p" color="colorTextWeak">
                  No logs available
                </Text>
              </Box>
            </Card>
          ) : (
            <Card padding="space0">
              <Table>
                <THead>
                  <Tr>
                    <Th>Status</Th>
                    <Th>Plan</Th>
                    <Th>Message</Th>
                    <Th>Time</Th>
                  </Tr>
                </THead>
                <TBody>
                  {logs.map((log) => (
                    <Tr key={log.id}>
                      <Td>
                        <Badge as="span" variant={log.success ? 'neutral' : 'error'}>
                          {log.success ? 'Success' : 'Failed'}
                        </Badge>
                      </Td>
                      <Td>
                        {log.planName ? (
                          <Box>
                            <Text as="div" fontWeight="fontWeightSemibold">
                              {log.planName}
                            </Text>
                            <Text as="div" fontSize="fontSize20" color="colorTextWeak">
                              PSID: {log.psid}
                            </Text>
                          </Box>
                        ) : (
                          <Text as="span" color="colorTextWeak">
                            —
                          </Text>
                        )}
                      </Td>
                      <Td>
                        <Box maxWidth="size50">
                          <Text as="span">{log.message}</Text>
                        </Box>
                      </Td>
                      <Td>
                        <Text as="span" fontSize="fontSize20" color="colorTextWeak">
                          {formatDate(log.timestamp)}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
