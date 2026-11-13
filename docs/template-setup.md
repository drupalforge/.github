---
title: Build a site template
---

# Build a site template

[Documentation home](index.md)

Use the [starter template](https://github.com/drupalforge/starter_template) to
create a Drupal Forge app from a Composer project. If you are turning an
existing Drupal Forge app into a template, you do not need the starter
repository.

## Track your progress

Create a setup issue in your template repository using the
[Drupal Forge template setup checklist](https://github.com/drupalforge/.github/blob/main/.github/ISSUE_TEMPLATE/drupal-forge-setup.md).
GitHub saves checkbox changes in the issue for users with editing permission;
checkboxes on this documentation site do not save progress.

For repositories in the Drupal Forge organization without their own issue
templates, GitHub offers this checklist as an organization default. Enable
Issues in your repository settings if necessary, then select the checklist
from **Issues > New issue**.

For repositories outside the organization, or those with their own issue
templates, copy the checklist file to
`.github/ISSUE_TEMPLATE/drupal-forge-setup.md` in your repository and commit it,
or paste its checklist body into a new issue.

## Prepare the repository

1. Create a repository from the starter template.
2. Choose the Composer project. The starter performs a clean Drupal install
   with a default admin password of `admin`.
   - `PROJECT` defaults to
     [drupal/recommended-project](https://www.drupal.org/docs/develop/using-composer/starting-a-site-using-drupal-composer-project-templates#s-drupalrecommended-project).
   - Set a different default in `.devpanel/composer_setup.sh`, or provide
     `PROJECT` as an environment variable.
   - To skip Composer project creation, add your own `composer.json` to the
     repository root.
3. Customize the example README to describe your template and how to launch it.
4. Run the app and confirm that it installs:
   - [DevPanel](https://www.devpanel.com): deployment files are in `.devpanel`.
     You can also copy that directory into an existing repository.
   - Any tool supporting [dev containers](https://containers.dev/supporting).
   - [DDEV](https://ddev.com).

## Publish a quick start image (optional)

A pre-deployed Docker image reduces the time needed to launch a site.

1. Add a build workflow from the GitHub **Actions** tab.
   - In the Drupal Forge organization, choose **Docker build and push
     template** from the
     [organization workflow templates](https://github.com/drupalforge/.github/tree/main/workflow-templates).
   - Otherwise, use the
     [Drupal Forge Docker Publish action](https://github.com/marketplace/actions/drupal-forge-docker-publish)
     and its reusable workflow.
2. Configure the `DOCKERHUB_USERNAME` repository variable and
   `DOCKERHUB_TOKEN` repository secret. Configure initialization secrets such
   as `DP_AI_VIRTUAL_KEY` or `COMPOSER_AUTH` only if your app needs them; never
   put their values in an issue or documentation.
3. Push to a branch configured in your workflow, or run the workflow manually,
   and confirm the image is published to Docker Hub. Images for the Drupal
   Forge organization are in its
   [Docker Hub account](https://hub.docker.com/u/drupalforge).

For example:

{% raw %}
```yaml
name: Docker build and push template
on:
  push:
    branches:
      - main
      - test/*
  workflow_dispatch:
jobs:
  build-application:
    uses: drupalforge/docker_publish_action/.github/workflows/docker-publish.yml@main
    with:
      dockerhub_username: ${{ vars.DOCKERHUB_USERNAME }}
    secrets:
      dockerhub_token: ${{ secrets.DOCKERHUB_TOKEN }}
      init_env: |
        {
          "DP_AI_VIRTUAL_KEY": ${{ toJSON(secrets.DP_AI_VIRTUAL_KEY) }},
          "COMPOSER_AUTH": ${{ toJSON(secrets.COMPOSER_AUTH) }}
        }
```
{% endraw %}

## Set up the template in DevPanel

> **TODO:** Add the detailed DevPanel template setup steps here.

This is required even if you have already tested the app locally.

1. Sign in to the [DevPanel console](https://console.devpanel.com/).
2. Set up the template in DevPanel.
3. Verify that the template is ready to launch an app.

## Create the Drupal Forge template page

> **TODO:** Add the detailed steps for creating and publishing the Drupal Forge
> template page here.

1. Sign in to [Drupal Forge](https://www.drupalforge.org/).
2. Create the template page.
3. Publish the template page.
4. Test launching an app from the page.

## Get help

Ask in [#drupalforge](https://drupal.slack.com/archives/C077WUMH7P1) on Drupal
Slack. See [Get involved](community.md) for vendor and contribution information.
