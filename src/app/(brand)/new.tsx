import { router } from 'expo-router';
import { View } from 'react-native';
import { CampaignForm } from '../../components/CampaignForm';
import { Screen, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';

export default function NewCampaign() {
  const { profile } = useAuth();
  const { toast, show } = useToast();
  return (
    <View style={{ flex: 1 }}>
      <Screen title="New campaign">
        <CampaignForm brandId={profile?.brand_id} onDone={(m) => { show(m); setTimeout(() => router.push('/(brand)/campaigns'), 800); }} />
      </Screen>
      {toast}
    </View>
  );
}
