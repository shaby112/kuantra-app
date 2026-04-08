from app.services.smmp_normalizers import get_adapter


def test_reddit_normalizer_maps_core_fields():
    adapter = get_adapter("reddit")
    result = adapter.normalize_post(
        {
            "data": {
                "id": "abc123",
                "selftext": "hello from reddit",
                "ups": 12,
                "num_comments": 4,
                "num_crossposts": 1,
                "view_count": 200,
                "url": "https://reddit.com/post",
            }
        }
    )

    assert result.external_id == "abc123"
    assert result.content == "hello from reddit"
    assert result.metrics.likes == 12
    assert result.metrics.comments == 4
    assert result.media_urls == ["https://reddit.com/post"]


def test_x_normalizer_maps_public_metrics():
    adapter = get_adapter("x")
    result = adapter.normalize_post(
        {
            "data": {
                "id": "1888",
                "text": "hello from x",
                "public_metrics": {
                    "like_count": 8,
                    "retweet_count": 2,
                    "reply_count": 1,
                    "impression_count": 500,
                },
            }
        }
    )

    assert result.external_id == "1888"
    assert result.metrics.likes == 8
    assert result.metrics.shares == 2
    assert result.metrics.comments == 1
    assert result.metrics.impressions == 500
