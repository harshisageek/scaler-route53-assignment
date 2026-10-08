import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Skeleton from '@cloudscape-design/components/skeleton';
import SpaceBetween from '@cloudscape-design/components/space-between';

export default function Route53Loading() {
  return (
    <ContentLayout header={<Header variant="h1">Loading Route 53</Header>}>
      <Container>
        <SpaceBetween size="m">
          <Skeleton variant="text-heading-l" />
          <Skeleton variant="text-body-m" />
          <Skeleton variant="text-body-m" />
        </SpaceBetween>
      </Container>
    </ContentLayout>
  );
}
