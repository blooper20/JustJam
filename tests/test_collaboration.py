import os
import uuid

from fastapi import status

from src.api.models import ProjectModel


def test_collaboration_workflow(client, auth_headers, test_user, db):
    # 1. Setup a test project owned by the user
    project_id = str(uuid.uuid4())
    project = ProjectModel(
        id=project_id,
        name="Collaboration Test Project",
        original_filename="test.mp3",
        user_id=test_user.id,
        status="completed",
    )
    db.add(project)
    db.commit()

    # 2. Create a general post
    post_data = {
        "title": "Welcome Announcement",
        "content": "Hello team, let's start practicing!",
        "post_type": "general",
    }
    response = client.post(f"/projects/{project_id}/posts", json=post_data, headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    post_json = response.json()
    assert post_json["title"] == "Welcome Announcement"
    assert post_json["post_type"] == "general"
    post_id = post_json["id"]

    # 3. List posts
    response = client.get(f"/projects/{project_id}/posts", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    posts = response.json()
    assert len(posts) >= 1
    assert posts[0]["id"] == post_id

    # 4. Add a comment
    comment_data = {"content": "Great announcement!"}
    response = client.post(
        f"/projects/{project_id}/posts/{post_id}/comments", json=comment_data, headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    comment_json = response.json()
    assert comment_json["content"] == "Great announcement!"
    comment_id = comment_json["id"]

    # 5. Delete the comment
    response = client.delete(
        f"/projects/{project_id}/posts/{post_id}/comments/{comment_id}", headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK

    # 6. Create a vote post
    vote_post_data = {
        "title": "Song Choice Poll",
        "content": "Which song should we perform next?",
        "post_type": "vote",
        "options": ["Song A", "Song B"],
    }
    response = client.post(
        f"/projects/{project_id}/posts", json=vote_post_data, headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    vote_post_json = response.json()
    assert vote_post_json["post_type"] == "vote"
    assert len(vote_post_json["options"]) == 2
    vote_post_id = vote_post_json["id"]
    option_id = vote_post_json["options"][0]["id"]

    # 7. Vote for the first option (toggles on)
    response = client.post(
        f"/projects/{project_id}/posts/{vote_post_id}/vote/{option_id}", headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    updated_post = response.json()
    assert updated_post["options"][0]["votes_count"] == 1
    assert test_user.id in updated_post["options"][0]["voted_user_ids"]

    # 8. Create a schedule post
    schedule_post_data = {
        "title": "Rehearsal Sync",
        "content": "Select your availability:",
        "post_type": "schedule",
        "schedule_times": ["2026-06-01 14:00", "2026-06-02 18:00"],
    }
    response = client.post(
        f"/projects/{project_id}/posts", json=schedule_post_data, headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    sched_post_json = response.json()
    assert sched_post_json["post_type"] == "schedule"
    assert len(sched_post_json["schedule_times"]) == 2
    sched_post_id = sched_post_json["id"]
    time_slot_id = sched_post_json["schedule_times"][0]["id"]

    # 9. Toggle availability for the time slot (toggles on)
    response = client.post(
        f"/projects/{project_id}/posts/{sched_post_id}/availability/{time_slot_id}",
        headers=auth_headers,
    )
    assert response.status_code == status.HTTP_200_OK
    updated_sched_post = response.json()
    assert updated_sched_post["schedule_times"][0]["availabilities_count"] == 1
    assert test_user.id in updated_sched_post["schedule_times"][0]["available_user_ids"]

    # 10. Practice Vlog Upload
    with open("test_vlog.mp4", "wb") as f:
        f.write(b"fake video mp4 data")

    try:
        with open("test_vlog.mp4", "rb") as f:
            url = (
                f"/projects/{project_id}/practice-logs"
                "?logged_date=2026-05-28&description=First+practice+vlog"
            )
            response = client.post(
                url,
                files={"file": ("test_vlog.mp4", f, "video/mp4")},
                headers=auth_headers,
            )
        assert response.status_code == status.HTTP_200_OK
        vlog_json = response.json()
        assert vlog_json["logged_date"] == "2026-05-28"
        assert vlog_json["description"] == "First practice vlog"
        assert "video_url" in vlog_json
    finally:
        if os.path.exists("test_vlog.mp4"):
            os.remove("test_vlog.mp4")

    # 11. Search Users to invite
    response = client.get(f"/projects/{project_id}/search-users?q=jammer", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    users = response.json()
    assert isinstance(users, list)
