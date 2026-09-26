import { RoleTabs } from '../../components/TabsLayout';

export default function AdminLayout() {
  return (
    <RoleTabs role="admin" tabs={[
      { name: 'overview', title: 'Money', icon: 'overview' },
      { name: 'videos', title: 'Videos', icon: 'videos' },
      { name: 'campaigns', title: 'Campaigns', icon: 'campaigns' },
      { name: 'people', title: 'People', icon: 'people' },
    ]} />
  );
}
