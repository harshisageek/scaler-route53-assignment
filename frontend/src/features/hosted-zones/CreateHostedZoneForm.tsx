'use client';

import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Textarea from '@cloudscape-design/components/textarea';
import Tiles from '@cloudscape-design/components/tiles';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useFlash } from '@/features/shell/flash';
import { ROUTES } from '@/features/shell/navigation';
import { fieldErrorsFrom } from '@/lib/api/fieldErrors';
import type { HostedZoneCreate } from '@/lib/api/types';
import { useCreateHostedZone } from './api';
import { displayZoneName } from './format';
import { AWS_REGIONS } from './regions';
import {
  COMMENT_MAX_LENGTH,
  validateComment,
  validateVpcId,
  validateZoneName,
} from './validation';
import { type EditableTag, tagsForRequest, ZoneTagEditor } from './ZoneTagEditor';

type ZoneType = 'public' | 'private';
type Errors = Partial<
  Record<'name' | 'comment' | 'region' | 'vpcId' | 'tags' | 'form', string>
>;

const REGION_OPTIONS: SelectProps.Option[] = AWS_REGIONS.map((region) => ({
  value: region.code,
  label: region.name,
  description: region.code,
}));

export function CreateHostedZoneForm() {
  const router = useRouter();
  const notify = useFlash();
  const createZone = useCreateHostedZone();
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>('public');
  const [region, setRegion] = useState<SelectProps.Option | null>(null);
  const [vpcId, setVpcId] = useState('');
  const [tags, setTags] = useState<EditableTag[]>([]);
  const [tagsValid, setTagsValid] = useState(true);
  const [errors, setErrors] = useState<Errors>({});

  const followCancel = (event: CustomEvent) => {
    event.preventDefault();
    router.push(ROUTES.hostedZones);
  };

  const validate = (): Errors => {
    const found: Errors = {
      name: validateZoneName(name),
      comment: validateComment(comment),
    };
    if (zoneType === 'private') {
      if (!region) found.region = 'Choose a Region.';
      found.vpcId = validateVpcId(vpcId);
    }
    if (!tagsValid) found.tags = 'Fix the tag errors before creating the hosted zone.';
    return Object.fromEntries(
      Object.entries(found).filter(([, message]) => message),
    ) as Errors;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body: HostedZoneCreate = {
      name: name.trim(),
      comment: comment.trim() || null,
      private_zone: zoneType === 'private',
      vpc:
        zoneType === 'private' && region
          ? {
              region: region.value as NonNullable<HostedZoneCreate['vpc']>['region'],
              vpc_id: vpcId.trim(),
            }
          : null,
      tags: tagsForRequest(tags),
    };
    createZone.mutate(body, {
      onSuccess: (zone) => {
        notify({
          type: 'success',
          content: `${displayZoneName(zone.name)} was successfully created.`,
          showOn: ROUTES.hostedZone(zone.id),
        });
        router.push(ROUTES.hostedZone(zone.id));
      },
      onError: (error) => {
        const fields = fieldErrorsFrom(error);
        if (Object.keys(fields).length === 0) {
          setErrors({ form: error.message });
          return;
        }
        setErrors({
          name: fields.name,
          comment: fields.comment,
          region: fields['vpc.region'],
          vpcId: fields['vpc.vpc_id'],
          tags: fields.tags,
          form: fields[''] ?? fields.vpc,
        });
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Form
        header={<Header variant="h1">Create hosted zone</Header>}
        errorText={errors.form}
        errorIconAriaLabel="Error"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              formAction="none"
              href={ROUTES.hostedZones}
              onFollow={followCancel}
            >
              Cancel
            </Button>
            <Button variant="primary" formAction="submit" loading={createZone.isPending}>
              Create hosted zone
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          <Container
            header={
              <Header
                variant="h2"
                description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains."
              >
                Hosted zone configuration
              </Header>
            }
          >
            <SpaceBetween size="l">
              <FormField
                label="Domain name"
                description="This is the name of the domain that you want to route traffic for."
                constraintText="Valid characters: a-z, 0-9, - (hyphen) and _ (underscore). Up to 253 characters."
                errorText={errors.name}
              >
                <Input
                  value={name}
                  onChange={({ detail }) => setName(detail.value)}
                  placeholder="example.com"
                  ariaRequired
                  autoFocus
                />
              </FormField>

              <FormField
                label={
                  <span>
                    Description - <i>optional</i>
                  </span>
                }
                description="This value lets you distinguish hosted zones that have the same name."
                constraintText={`The description can have up to ${COMMENT_MAX_LENGTH} characters. ${comment.length}/${COMMENT_MAX_LENGTH}`}
                errorText={errors.comment}
              >
                <Textarea
                  value={comment}
                  onChange={({ detail }) => setComment(detail.value)}
                  placeholder="The hosted zone is used for..."
                />
              </FormField>

              <FormField
                label="Type"
                description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC."
              >
                <Tiles
                  value={zoneType}
                  onChange={({ detail }) => setZoneType(detail.value as ZoneType)}
                  columns={2}
                  items={[
                    {
                      value: 'public',
                      label: 'Public hosted zone',
                      description:
                        'A public hosted zone determines how traffic is routed on the internet.',
                    },
                    {
                      value: 'private',
                      label: 'Private hosted zone',
                      description:
                        'A private hosted zone determines how traffic is routed within an Amazon VPC.',
                    },
                  ]}
                />
              </FormField>
            </SpaceBetween>
          </Container>

          {zoneType === 'private' && (
            <Container
              header={
                <Header
                  variant="h2"
                  description="To use this hosted zone to resolve DNS queries for a VPC, choose the VPC. VPCs in this clone are mocked: any well-formed ID is accepted."
                >
                  VPC to associate with the hosted zone
                </Header>
              }
            >
              <SpaceBetween size="l">
                <FormField label="Region" errorText={errors.region}>
                  <Select
                    selectedOption={region}
                    onChange={({ detail }) => setRegion(detail.selectedOption)}
                    options={REGION_OPTIONS}
                    placeholder="Choose a Region"
                    filteringType="auto"
                  />
                </FormField>
                <FormField
                  label="VPC ID"
                  constraintText="Format: vpc-0a1b2c3d"
                  errorText={errors.vpcId}
                >
                  <Input
                    value={vpcId}
                    onChange={({ detail }) => setVpcId(detail.value)}
                    placeholder="vpc-0a1b2c3d"
                  />
                </FormField>
              </SpaceBetween>
            </Container>
          )}
          <Container
            header={
              <Header
                variant="h2"
                description="Tags are key-value labels that help organize and filter hosted zones."
              >
                Tags - optional
              </Header>
            }
          >
            <SpaceBetween size="s">
              {errors.tags && <Alert type="error">{errors.tags}</Alert>}
              <ZoneTagEditor
                tags={tags}
                onChange={(next, valid) => {
                  setTags(next);
                  setTagsValid(valid);
                  if (valid) setErrors((current) => ({ ...current, tags: undefined }));
                }}
              />
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      </Form>
    </form>
  );
}
