"""
FastAPI wrapper for the LanceDB facet search engine built on influencer_facets.
Provides higher-level orchestration for dense, lexical, and hybrid retrieval.
"""
import os
import sys
import json
import logging
from typing import List, Optional, Dict, Any, Tuple, Callable, Union, Iterable
from urllib.parse import urlparse

# Add the DIME-AI-DB src directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
dime_db_root = os.path.join(project_root, "DIME-AI-DB")
dime_db_src = os.path.join(dime_db_root, "src")

for path in (dime_db_root, dime_db_src):
    if path not in sys.path and os.path.isdir(path):
        sys.path.insert(0, path)

# Import from the new vector search engine
from .vector_search import VectorSearchEngine, SearchWeights, SearchParams
from app.core.models.domain import CreatorProfile
from app.core.post_filter import ProfileFitAssessor, ProfileFitResult
from app.config import settings
from app.core.pipeline.stages.brightdata_stage import BrightDataStage
from app.core.pipeline.stages.llm_fit_stage import LLMFitStage
from app.core.pipeline.utils import build_profile_refs, normalized_profile_key

logger = logging.getLogger("search_engine")

class CreatorSearchEngine:
    """FastAPI wrapper for the VectorSearchEngine"""
    
    def __init__(self, db_path: str):
        self.engine = VectorSearchEngine(
            db_path=db_path,
            table_name=settings.TABLE_NAME or "influencer_facets",
            model_name=settings.EMBED_MODEL,
        )
        
        # Content categories for campaign matching
        self.content_categories = {
            'lifestyle': ['lifestyle', 'daily life', 'life', 'routine', 'vlog', 'personal', 'day in my life', 'grwm'],
            'fashion': ['fashion', 'style', 'outfit', 'ootd', 'clothing', 'trendy', 'streetwear', 'aesthetic'],
            'beauty': ['beauty', 'makeup', 'skincare', 'cosmetics', 'glam', 'tutorial', 'review', 'routine'],
            'tech': ['tech', 'technology', 'gadget', 'app', 'phone', 'gaming', 'review', 'unboxing'],
            'fitness': ['fitness', 'workout', 'gym', 'health', 'wellness', 'yoga', 'training', 'sport'],
            'travel': ['travel', 'trip', 'vacation', 'explore', 'adventure', 'destination', 'wanderlust'],
            'food': ['food', 'cooking', 'recipe', 'restaurant', 'foodie', 'chef', 'cuisine', 'dining'],
            'entertainment': ['music', 'dance', 'comedy', 'entertainment', 'performance', 'artist', 'creative']
        }
    
    def _convert_to_search_result(self, row) -> CreatorProfile:
        """Convert pandas row to CreatorProfile dataclass"""
        # Helper function to safely convert values, handling NaN
        def safe_int(value, default=0):
            if value is None or (isinstance(value, float) and str(value).lower() == 'nan'):
                return default
            try:
                return int(value)
            except (ValueError, TypeError):
                return default
                
        def safe_float(value, default=0.0):
            if value is None or (isinstance(value, float) and str(value).lower() == 'nan'):
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        def safe_optional_float(value):
            if value is None or (isinstance(value, float) and str(value).lower() == 'nan'):
                return None
            try:
                return float(value)
            except (ValueError, TypeError):
                return None

        def safe_str(value):
            if value is None:
                return None
            text_value = str(value)
            return text_value if text_value.lower() != 'nan' else None

        lance_identifier = safe_str(row.get('lance_db_id'))
        platform_value = safe_str(row.get('platform'))

        def safe_bool(value):
            if isinstance(value, bool):
                return value
            if value is None:
                return None
            text_value = str(value).strip().lower()
            if text_value in {'true', '1', 'yes', 'y'}:
                return True
            if text_value in {'false', '0', 'no', 'n'}:
                return False
            return None

        lance_identifier = safe_str(row.get('lance_db_id'))
        platform_value = safe_str(row.get('platform'))
        account_value = safe_str(row.get('account') or row.get('username') or row.get('display_name')) or ""
        profile_name_value = safe_str(row.get('profile_name') or row.get('display_name') or row.get('username') or account_value) or ""
        avg_engagement_value = safe_float(row.get('avg_engagement', row.get('engagement_rate', 0.0)), 0.0)
        business_category = safe_str(row.get('business_category_name') or row.get('occupation') or '') or ''
        business_address = safe_str(row.get('business_address') or row.get('location') or '') or ''
        posts_raw_value = safe_str(row.get('posts') or row.get('posts_raw'))

        return CreatorProfile(
            id=safe_int(row.get('id', lance_identifier or 0)),
            account=account_value,
            profile_name=profile_name_value,
            followers=safe_int(row.get('followers', 0)),
            avg_engagement=avg_engagement_value,
            business_category_name=business_category,
            business_address=business_address,
            biography=str(row.get('biography', '') or row.get('profile_text') or ''),
            profile_image_link=str(row.get('profile_image_link') or row.get('profile_image_url') or ''),
            profile_url=safe_str(row.get('profile_url') or row.get('url')),
            is_personal_creator=bool(safe_int(row.get('individual_vs_org_score', 5)) < 5),
            is_verified=safe_bool(row.get('is_verified')),
            posts_raw=posts_raw_value,
            lance_db_id=lance_identifier,
            platform=platform_value.lower() if isinstance(platform_value, str) else platform_value,
            platform_id=safe_str(row.get('platform_id')),
            username=safe_str(row.get('username') or row.get('account')),
            display_name=safe_str(row.get('display_name') or row.get('profile_name') or row.get('full_name')),
            profile_image_url=safe_str(row.get('profile_image_link') or row.get('profile_image_url')),
            # Original database LLM score columns (keep as integers)
            individual_vs_org_score=safe_int(row.get('individual_vs_org_score', 0)),
            generational_appeal_score=safe_int(row.get('generational_appeal_score', 0)),
            professionalization_score=safe_int(row.get('professionalization_score', 0)),
            relationship_status_score=safe_int(row.get('relationship_status_score', 0)),
            # Search score components
            bm25_fts_score=safe_optional_float(row.get('bm25_fts_score')),
            cos_sim_profile=safe_optional_float(row.get('cos_sim_profile')),
            cos_sim_posts=safe_optional_float(row.get('cos_sim_posts')),
            combined_score=safe_float(row.get('combined_score', row.get('vector_similarity_score', 0.0))),
            # Vector similarity scores (direct vector comparison)
            keyword_similarity=safe_optional_float(row.get('keyword_similarity')),
            profile_similarity=safe_optional_float(row.get('profile_similarity')),
            content_similarity=safe_optional_float(row.get('content_similarity')),
            vector_similarity_score=safe_optional_float(row.get('vector_similarity_score')),
            similarity_explanation=str(row.get('similarity_explanation', '')),
            score_mode=(safe_str(row.get('score_mode')) or 'hybrid'),
            profile_fts_source=safe_str(row.get('profile_fts_source')),
            posts_fts_source=safe_str(row.get('posts_fts_source')),
            fit_score=None,
            fit_rationale=None,
            fit_error=None,
            fit_prompt=None,
            fit_raw_response=None
        )

    def _coerce_search_result(self, payload: Union[CreatorProfile, Dict[str, Any]]) -> CreatorProfile:
        """Accept either API payloads or in-process CreatorProfile instances."""
        if isinstance(payload, CreatorProfile):
            return payload
        if isinstance(payload, dict):
            return self._convert_to_search_result(payload)
        raise TypeError(f"Unsupported profile payload type: {type(payload)!r}")

    def _prepare_results(
        self,
        profiles: Optional[List[Union[CreatorProfile, Dict[str, Any]]]],
        max_profiles: Optional[int] = None,
    ) -> List[CreatorProfile]:
        if not profiles:
            return []

        all_results = [self._coerce_search_result(payload) for payload in profiles]
        if max_profiles is None:
            limit_count = len(all_results)
        else:
            limit_count = max(1, min(int(max_profiles), len(all_results)))

        return all_results[:limit_count]

    def _placeholder_results_from_urls(
        self,
        profile_urls: List[str],
        max_profiles: Optional[int],
    ) -> List[CreatorProfile]:
        if not profile_urls:
            return []
        trimmed = profile_urls[: max_profiles] if max_profiles else profile_urls

        results: List[CreatorProfile] = []
        for url in trimmed:
            handle = self._extract_account_from_url(url)
            safe_account = handle or url
            results.append(
                CreatorProfile(
                    id=0,
                    account=safe_account,
                    profile_name=safe_account,
                    followers=0,
                    avg_engagement=0.0,
                    business_category_name="",
                    business_address="",
                    biography="",
                    profile_image_link="",
                    profile_url=url,
                    username=handle,
                    display_name=handle,
                )
            )
        return results

    @staticmethod
    def _extract_account_from_url(url: Optional[str]) -> Optional[str]:
        if not url:
            return None
        debug["brightdata_success_keys"] = []
        try:
            parsed = urlparse(url)
        except Exception:
            return None
        path = (parsed.path or "").strip("/")
        if not path:
            return None
        handle = path.split("/")[0]
        return handle.lstrip("@") or None
        
    def search_creators_for_campaign(
        self,
        *,
        query: str,
        method: str = "hybrid",
        limit: int = 20,
        min_followers: Optional[int] = None,
        max_followers: Optional[int] = None,
        min_engagement: Optional[float] = None,
        max_engagement: Optional[float] = None,
        location: Optional[str] = None,
        category: Optional[str] = None,
        is_verified: Optional[bool] = None,
        is_business_account: Optional[bool] = None,
        lexical_scope: str = "bio",
    ) -> List[CreatorProfile]:
        """Run a single-pass search with predictable behaviour."""

        method_lower = (method or "").strip().lower()

        query_text = (query or "").strip()
        if not query_text:
            return []

        filters: Dict[str, Any] = {}

        follower_lower = int(min_followers) if min_followers is not None else None
        follower_upper = int(max_followers) if max_followers is not None else None
        if follower_lower is not None or follower_upper is not None:
            filters["followers"] = (
                follower_lower if follower_lower is not None else 0,
                follower_upper,
            )

        eng_lower = float(min_engagement) if min_engagement is not None else None
        eng_upper = float(max_engagement) if max_engagement is not None else None
        if eng_lower is not None or eng_upper is not None:
            filters["engagement_rate"] = (
                eng_lower if eng_lower is not None else 0.0,
                eng_upper,
            )

        if is_verified is not None:
            filters["is_verified"] = is_verified

        if is_business_account is not None:
            filters["is_business_account"] = is_business_account

        if location:
            filters["location"] = location.strip()

        if category:
            filters["business_category_name"] = category.strip()

        params = SearchParams(
            query=query_text,
            method=method_lower,
            limit=max(1, limit),
            filters=filters or None,
            lexical_include_posts=(method_lower == "lexical" and lexical_scope == "bio_posts"),
        )

        results_df = self.engine.search(params=params)

        search_results: List[CreatorProfile] = []
        for _, row in results_df.iterrows():
            search_results.append(self._convert_to_search_result(row))

        for item in search_results:
            item.score_mode = method_lower or "hybrid"
            if method_lower == "lexical":
                item.cos_sim_profile = None
                item.cos_sim_posts = None
                item.vector_similarity_score = None
                item.keyword_similarity = None
                item.profile_similarity = None
                item.content_similarity = None
            elif method_lower == "semantic":
                item.bm25_fts_score = None
                item.profile_fts_source = None
                item.posts_fts_source = None

        return search_results

    def evaluate_profiles(
        self,
        profiles: List[Union[CreatorProfile, Dict[str, Any]]],
        *,
        business_fit_query: Optional[str] = None,
        run_brightdata: bool = False,
        run_llm: bool = False,
        max_profiles: Optional[int] = None,
        max_posts: int = 6,
        model: str = "gpt-5-mini",
        verbosity: str = "medium",
        concurrency: int = 64,
        progress_cb: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> Tuple[List[CreatorProfile], Dict[str, Any]]:
        """Run optional BrightData refresh and/or LLM scoring on a result set."""

        search_results = self._prepare_results(profiles, max_profiles)

        if not search_results:
            return [], {"brightdata_results": [], "profile_fit": []}

        debug: Dict[str, Any] = {"brightdata_results": [], "profile_fit": []}

        brightdata_success_keys: List[str] = []
        if run_brightdata:
            brightdata_stage = BrightDataStage()
            bd_result = brightdata_stage.run(search_results, progress_cb=progress_cb)
            search_results = bd_result.profiles
            debug["brightdata_results"] = bd_result.debug.get("brightdata_results", [])
            brightdata_success_keys = bd_result.debug.get("success_keys", []) or []

        llm_inputs: List[CreatorProfile] = list(search_results)
        if run_brightdata:
            key_set = {key.lower() for key in brightdata_success_keys}
            if key_set:
                llm_inputs = [
                    result for result in search_results if normalized_profile_key(result) in key_set
                ]
            else:
                llm_inputs = []
            if progress_cb:
                progress_cb(
                    "BRIGHTDATA_FILTERED",
                    {
                        "survivors": len(llm_inputs),
                        "dropped": max(0, len(search_results) - len(llm_inputs)),
                        "io": {
                            "inputs": build_profile_refs(search_results),
                            "outputs": build_profile_refs(llm_inputs),
                        },
                    },
                )
            if run_brightdata and run_llm:
                search_results = llm_inputs

        if run_llm:
            if not business_fit_query:
                raise ValueError("business_fit_query is required when run_llm is True")
            if not llm_inputs:
                debug["profile_fit"] = []
                return llm_inputs, debug

            llm_stage = LLMFitStage(ProfileFitAssessor)
            llm_result = llm_stage.run(
                llm_inputs,
                progress_cb=progress_cb,
                business_fit_query=business_fit_query,
                max_posts=max_posts,
                concurrency=concurrency,
                model=model,
                verbosity=verbosity,
            )
            search_results = llm_result.profiles
            debug["profile_fit"] = llm_result.debug.get("profile_fit", [])

        return search_results, debug

    def run_brightdata_stage(
        self,
        profiles: Optional[List[Union[CreatorProfile, Dict[str, Any]]]] = None,
        *,
        max_profiles: Optional[int] = None,
        progress_cb: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> Tuple[List[CreatorProfile], Dict[str, Any]]:
        normalized_input: List[Union[CreatorProfile, Dict[str, Any]]] = list(profiles or [])
        search_results = self._prepare_results(normalized_input, max_profiles)

        if not search_results:
            raise ValueError("profiles is required for BrightData stage")

        stage = BrightDataStage()
        result = stage.run(search_results, progress_cb=progress_cb)
        debug = {
            "brightdata_results": result.debug.get("brightdata_results", []),
            "brightdata_success_keys": result.debug.get("success_keys", []),
        }
        return result.profiles, debug

    def run_profile_fit_stage(
        self,
        profiles: Optional[List[Union[CreatorProfile, Dict[str, Any]]]] = None,
        *,
        business_fit_query: str,
        max_profiles: Optional[int] = None,
        concurrency: int = 64,
        max_posts: int = 6,
        model: str = "gpt-5-mini",
        verbosity: str = "medium",
        use_brightdata: bool = False,
        progress_cb: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> Tuple[List[CreatorProfile], Dict[str, Any]]:
        if not business_fit_query:
            raise ValueError("business_fit_query must be provided for profile fit stage")

        normalized_input: List[Union[CreatorProfile, Dict[str, Any]]] = list(profiles or [])
        search_results = self._prepare_results(normalized_input, max_profiles)
        if not search_results:
            return [], {"brightdata_results": [], "profile_fit": []}

        debug: Dict[str, Any] = {"brightdata_results": [], "profile_fit": []}
        working_set = list(search_results)

        if use_brightdata:
            brightdata_stage = BrightDataStage()
            bd_result = brightdata_stage.run(working_set, progress_cb=progress_cb)
            working_set = bd_result.profiles
            debug["brightdata_results"] = bd_result.debug.get("brightdata_results", [])

        llm_stage = LLMFitStage(ProfileFitAssessor)
        llm_result = llm_stage.run(
            working_set,
            progress_cb=progress_cb,
            business_fit_query=business_fit_query,
            max_posts=max_posts,
            concurrency=concurrency,
            model=model,
            verbosity=verbosity,
        )

        debug["profile_fit"] = llm_result.debug.get("profile_fit", [])
        return llm_result.profiles, debug

    def run_profile_fit_preview(
        self,
        *,
        business_fit_query: str,
        account: Optional[str] = None,
        profile_url: Optional[str] = None,
        max_posts: int = 6,
        model: str = "gpt-5-mini",
        verbosity: str = "medium",
        use_brightdata: bool = False,
        concurrency: int = 2,
    ) -> ProfileFitResult:
        """Score a single profile against a business brief."""
        if not business_fit_query:
            raise ValueError("business_fit_query is required")

        profile: Optional[CreatorProfile] = None
        if account:
            profile = self.get_creator_by_username(account)

        if profile is None and profile_url:
            profile = self._get_profile_by_url(profile_url)

        if profile is None:
            raise ValueError("Profile not found for profile fit preview")

        profiles = [profile]
        if use_brightdata:
            try:
                BrightDataStage().run(profiles)
            except Exception as exc:  # pylint: disable=broad-except
                print(f"[WARN] BrightData refresh failed: {exc}")

        assessor = ProfileFitAssessor(
            business_query=business_fit_query,
            model=model,
            verbosity=verbosity,
            max_posts=max_posts,
            concurrency=max(1, concurrency),
            openai_api_key=settings.OPENAI_API_KEY.get_secret_value() if settings.OPENAI_API_KEY else None,
        )

        documents = [
            {
                "account": profile.account,
                "profile_url": profile.profile_url or (f"https://instagram.com/{profile.account}" if profile.account else None),
                "followers": profile.followers,
                "biography": profile.biography,
                "profile_name": profile.profile_name,
                "business_category_name": profile.business_category_name,
                "category_name": profile.business_category_name,
                "is_verified": profile.is_verified,
                "posts": profile.posts_raw,
            }
        ]

        fit_result = assessor.score_profiles(documents)[0]
        profile.fit_score = fit_result.score
        profile.fit_rationale = fit_result.rationale
        profile.fit_error = fit_result.error
        return fit_result

    def _get_profile_by_url(self, profile_url: str) -> Optional[CreatorProfile]:
        """Fetch a single creator profile by profile_url."""
        if not profile_url:
            return None

        normalized = profile_url.strip().replace("'", "''")
        if not normalized:
            return None

        profile_row = self.engine.get_profile_by_url(normalized)
        if profile_row is None:
            return None

        row = profile_row.copy()
        row['account'] = row.get('username') or row.get('account') or ''
        row['profile_name'] = row.get('display_name') or row.get('profile_name') or row.get('username') or ''
        row.setdefault('bm25_fts_score', row.get('keyword_score'))
        row.setdefault('cos_sim_profile', row.get('profile_score'))
        row.setdefault('cos_sim_posts', row.get('content_score'))
        row.setdefault('profile_fts_source', row.get('profile_text'))
        row.setdefault('posts_fts_source', row.get('posts_text'))
        row.setdefault('combined_score', row.get('cos_sim_profile'))
        row.setdefault('vector_similarity_score', row.get('combined_score'))
        return self._convert_to_search_result(row)

    def get_creator_by_username(self, username: str) -> Optional[CreatorProfile]:
        """Fetch a single creator profile by username."""
        if not username:
            return None

        normalized = username.strip().lstrip('@')
        if not normalized:
            return None

        profile_row = self.engine.get_profile_by_username(normalized)
        if profile_row is None or getattr(profile_row, 'empty', False):
            return None

        row = profile_row.copy()
        row['account'] = row.get('username') or normalized
        row['profile_name'] = row.get('display_name') or row.get('username') or normalized
        row.setdefault('bm25_fts_score', row.get('keyword_score'))
        row.setdefault('cos_sim_profile', row.get('profile_score'))
        row.setdefault('cos_sim_posts', row.get('content_score'))
        row.setdefault('profile_fts_source', row.get('profile_text'))
        row.setdefault('posts_fts_source', row.get('posts_text'))
        row.setdefault('combined_score', row.get('cos_sim_profile'))
        row.setdefault('vector_similarity_score', row.get('combined_score'))
        return self._convert_to_search_result(row)
    
    def match_creators_to_business(
        self,
        business_description: str,
        method: str = "hybrid",
        limit: int = 20,
        min_followers: Optional[int] = 1000,
        max_followers: Optional[int] = 10000000,
        min_engagement: float = 0.0,
        location: Optional[str] = None,
        target_category: Optional[str] = None,
    ) -> List[CreatorProfile]:
        """Match creators to a business brief using the simplified search pipeline."""

        search_query = self._business_to_creator_query(business_description, target_category)

        return self.search_creators_for_campaign(
            query=search_query,
            method=method,
            limit=limit,
            min_followers=min_followers,
            max_followers=max_followers,
            min_engagement=min_engagement,
            location=location,
            category=target_category,
        )
    
    def _business_to_creator_query(self, business_description: str, target_category: Optional[str] = None) -> str:
        """Convert business description to creator search query"""
        query_parts = [business_description]
        
        # Add category-specific terms
        if target_category and target_category in self.content_categories:
            category_terms = self.content_categories[target_category][:3]
            query_parts.extend(category_terms)
        
        # Add influencer/creator context
        query_parts.append("content creator influencer")
        
        return " ".join(query_parts)
    
    def find_similar_creators(
        self,
        reference_account: str,
        limit: int = 10,
        min_followers: Optional[int] = None,
        max_followers: Optional[int] = None,
        min_engagement: Optional[float] = None,
        max_engagement: Optional[float] = None,
        location: Optional[str] = None,
        category: Optional[str] = None,
    ) -> List[CreatorProfile]:
        """Find creators similar to a reference account using vector similarity."""

        filters: Dict[str, Any] = {}

        follower_lower = int(min_followers) if min_followers is not None else None
        follower_upper = int(max_followers) if max_followers is not None else None
        if follower_lower is not None or follower_upper is not None:
            filters["followers"] = (
                follower_lower if follower_lower is not None else 0,
                follower_upper,
            )

        eng_lower = float(min_engagement) if min_engagement is not None else None
        eng_upper = float(max_engagement) if max_engagement is not None else None
        if eng_lower is not None or eng_upper is not None:
            filters["engagement_rate"] = (
                eng_lower if eng_lower is not None else 0.0,
                eng_upper,
            )

        if location:
            filters["location"] = location.strip()

        if category:
            filters["business_category_name"] = category.strip()

        results_df = self.engine.search_similar_by_vectors(
            account_name=reference_account,
            limit=limit,
            weights=SearchWeights(keyword=0.2, profile=0.5, content=0.3),
            filters=filters or None,
        )

        search_results: List[CreatorProfile] = []
        for _, row in results_df.iterrows():
            search_results.append(self._convert_to_search_result(row))

        return search_results
    
    def search_by_category(
        self,
        category: str,
        location: Optional[str] = None,
        limit: int = 15,
        min_followers: Optional[int] = None,
        max_followers: Optional[int] = None,
        min_engagement: Optional[float] = None,
        max_engagement: Optional[float] = None,
    ) -> List[CreatorProfile]:
        """Search creators by category with sensible defaults."""

        query_parts = [category]
        if category in self.content_categories:
            query_parts.extend(self.content_categories[category][:3])
        if location:
            query_parts.append(location)

        query = " ".join(query_parts)

        return self.search_creators_for_campaign(
            query=query,
            method="hybrid",
            limit=limit,
            min_followers=min_followers,
            max_followers=max_followers,
            min_engagement=min_engagement,
            max_engagement=max_engagement,
            location=location,
            category=category,
        )


FastAPISearchEngine = CreatorSearchEngine
