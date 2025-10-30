"""Public service interfaces."""

__all__ = ["SearchPipelineService"]


def __getattr__(name):
    if name == "SearchPipelineService":
        from .pipeline import SearchPipelineService as _SearchPipelineService

        return _SearchPipelineService
    raise AttributeError(name)
