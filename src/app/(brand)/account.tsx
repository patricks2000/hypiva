import { View } from 'react-native';
import { AccountSection } from '../../components/AccountSection';
import { Screen, useToast } from '../../components/ui';

export default function BrandAccount() {
  const { toast, show } = useToast();
  return (
    <View style={{ flex: 1 }}>
      <Screen title="Account"><AccountSection onToast={show} /></Screen>
      {toast}
    </View>
  );
}
