import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { keys } from './api';

/**
 * Refreshes data when either API reports a change, so edits made in another
 * tab, or in Delivery, show up here without a reload.
 */
export function useLiveUpdates(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const peopleEvents = new EventSource('/api/people/events');
    const deliveryEvents = new EventSource('/api/delivery/events');

    peopleEvents.onmessage = () => queryClient.invalidateQueries({ queryKey: keys.rates });
    deliveryEvents.onmessage = () => queryClient.invalidateQueries({ queryKey: keys.capacityUsage });

    return () => {
      peopleEvents.close();
      deliveryEvents.close();
    };
  }, [queryClient]);
}
