import { RoleTabs } from '../../components/TabsLayout';

export default function CreatorLayout() {
  return (
    <RoleTabs role="creator" tabs={[
      { name: 'home', title: 'Home', icon: 'home' },
      { name: 'discover', title: 'Discover', icon: 'discover' },
      { name: 'submit', title: 'Submit', icon: 'plus' },
      { name: 'wallet', title: 'Wallet', icon: 'wallet' },
      { name: 'profile', title: 'Profile', icon: 'profile' },
    ]} />
  );
}
