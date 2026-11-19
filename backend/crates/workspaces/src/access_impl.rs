//! Cài đặt [`AccessApi`] cho các module khác.

use crate::model::*;
use crate::service::WorkspaceService;
use bson::doc;
use chillcat_kernel::contracts::{AccessApi, GroupInfo, SubsystemInfo, WorkspaceAccess, WorkspaceInfo};
use chillcat_kernel::*;
use futures::TryStreamExt;
use std::collections::BTreeMap;

#[async_trait::async_trait]
impl AccessApi for WorkspaceService {
    async fn workspace(&self, id: &WorkspaceId) -> AppResult<Option<WorkspaceInfo>> {
        Ok(self.workspace_doc(id).await?.map(|w| w.info()))
    }

    async fn workspace_access(&self, user: &UserId, workspace: &WorkspaceId) -> AppResult<Option<WorkspaceAccess>> {
        self.access_of(user, workspace).await
    }

    async fn group(&self, id: &GroupId) -> AppResult<Option<GroupInfo>> {
        Ok(self.c.groups.find_one(doc! { "_id": id }).await?.map(|g| g.info()))
    }

    async fn groups(&self, workspace: &WorkspaceId) -> AppResult<Vec<GroupInfo>> {
        let list: Vec<GroupDoc> = self.c.groups.find(doc! { "workspace_id": workspace }).await?.try_collect().await?;
        Ok(list.iter().map(GroupDoc::info).collect())
    }

    async fn subsystem(&self, id: &SubsystemId) -> AppResult<Option<SubsystemInfo>> {
        Ok(self.c.subsystems.find_one(doc! { "_id": id }).await?.map(|s| s.info()))
    }

    async fn subsystems(&self, workspace: &WorkspaceId) -> AppResult<Vec<SubsystemInfo>> {
        let list: Vec<SubsystemDoc> = self.c.subsystems.find(doc! { "workspace_id": workspace }).await?.try_collect().await?;
        Ok(list.iter().map(SubsystemDoc::info).collect())
    }

    async fn group_member_ids(&self, group: &GroupId) -> AppResult<Vec<UserId>> {
        let list: Vec<MembershipDoc> =
            self.c.memberships.find(doc! { "scope_type": "group", "scope_id": group.as_str() }).await?.try_collect().await?;
        Ok(list.into_iter().map(|m| m.user_id).collect())
    }

    async fn users_with_doc_perm(&self, workspace: &WorkspaceId, group: &GroupId, perm: DocPerm) -> AppResult<Vec<UserId>> {
        let Some(w) = self.workspace_doc(workspace).await? else { return Ok(vec![]) };
        let ms: Vec<MembershipDoc> = self
            .c
            .memberships
            .find(doc! {
                "workspace_id": workspace,
                "$or": [ { "scope_type": "workspace" }, { "scope_type": "group", "scope_id": group.as_str() } ],
            })
            .await?
            .try_collect()
            .await?;
        let mut by_user: BTreeMap<String, Vec<MembershipDoc>> = BTreeMap::new();
        for m in ms {
            by_user.entry(m.user_id.to_string()).or_default().push(m);
        }
        by_user.entry(w.owner_id.to_string()).or_default();
        Ok(by_user
            .into_iter()
            .map(|(u, list)| (UserId::from(u), list))
            .filter(|(u, list)| Self::build_access(&w, u, list).doc_perms_in(group).has(perm))
            .map(|(u, _)| u)
            .collect())
    }
}
