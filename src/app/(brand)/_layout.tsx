import { RoleTabs } from '../../components/TabsLayout';

export default function BrandLayout() {
  return (
    <RoleTabs role="brand" tabs={[
      { name: 'campaigns', title: 'Campaigns', icon: 'campaigns' },
      { name: 'review', title: 'Review', icon: 'review' },
      { name: 'new', title: 'New', icon: 'plus' },
      { name: 'account', title: 'Account', icon: 'profile' },
    ]} />
  );
}
