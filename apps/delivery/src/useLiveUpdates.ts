import type { DeliveryEvent } from '@baseline/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { keys } from './api';

/**
 * Refreshes data when either API reports a change. A rate edited in People
 * reaches the cost view here without a reload.
 */
export function useLiveUpdates(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const peopleEvents = new EventSource('/api/people/events');
    const deliveryEvents = new EventSource('/api/delivery/events');

    peopleEvents.onmessage = () => queryClient.invalidateQueries({ queryKey: keys.rates });
    deliveryEvents.onmessage = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as DeliveryEvent;
      const queryKey = event.type === 'breakdown.changed' ? keys.allBreakdownItems : keys.allocations;
      void queryClient.invalidateQueries({ queryKey });
    };

    return () => {
      peopleEvents.close();
      deliveryEvents.close();
    };
  }, [queryClient]);
}
